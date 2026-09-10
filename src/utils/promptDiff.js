import { diffLines, diffChars } from 'diff'

/** 将 system / user blocks 展平为可对比文本 */
export function blocksToText(blocks = []) {
  return (blocks || [])
    .map((b, i) => {
      const id = String(b?.id || `block-${i}`)
      const text = String(b?.text || '')
      return `[${id}]\n${text}`
    })
    .join('\n\n')
}

export function jobBlocksToText(row) {
  if (!row) return ''
  const system = blocksToText(row.system_blocks || [])
  const user = blocksToText(row.user_blocks || [])
  if (user.trim()) return `${system}\n\n--- user ---\n\n${user}`
  return system
}

export function draftsToText(drafts = []) {
  return blocksToText(drafts)
}

function charParts(oldLine, newLine) {
  const parts = diffChars(oldLine, newLine)
  const left = []
  const right = []
  for (const p of parts) {
    if (p.removed) {
      left.push({ text: p.value, kind: 'del' })
    } else if (p.added) {
      right.push({ text: p.value, kind: 'add' })
    } else {
      left.push({ text: p.value, kind: 'same' })
      right.push({ text: p.value, kind: 'same' })
    }
  }
  return { left, right }
}

/** 生成左右对照行，供 UI 渲染 */
export function buildSideBySideDiff(oldText, newText) {
  const changes = diffLines(oldText || '', newText || '', { newlineIsToken: false })
  const rows = []
  let leftNo = 0
  let rightNo = 0

  for (const chunk of changes) {
    const lines = chunk.value.replace(/\n$/, '').split('\n')
    const isLastEmpty = chunk.value.endsWith('\n') && lines.length === 1 && lines[0] === ''

    if (chunk.removed) {
      for (const line of lines) {
        if (line === '' && isLastEmpty) continue
        leftNo += 1
        rows.push({
          kind: 'remove',
          leftNo,
          rightNo: null,
          left: line,
          right: '',
        })
      }
      continue
    }

    if (chunk.added) {
      for (const line of lines) {
        if (line === '' && isLastEmpty) continue
        rightNo += 1
        rows.push({
          kind: 'add',
          leftNo: null,
          rightNo,
          left: '',
          right: line,
        })
      }
      continue
    }

    for (const line of lines) {
      if (line === '' && isLastEmpty) continue
      leftNo += 1
      rightNo += 1
      rows.push({
        kind: 'same',
        leftNo,
        rightNo,
        left: line,
        right: line,
      })
    }
  }

  // 合并相邻 remove + add 为 change，并做行内高亮
  const merged = []
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const next = rows[i + 1]
    if (row.kind === 'remove' && next?.kind === 'add') {
      const { left, right } = charParts(row.left, next.right)
      merged.push({
        kind: 'change',
        leftNo: row.leftNo,
        rightNo: next.rightNo,
        left: row.left,
        right: next.right,
        leftParts: left,
        rightParts: right,
      })
      i += 1
    } else {
      merged.push(row)
    }
  }

  const stats = {
    same: merged.filter((r) => r.kind === 'same').length,
    changed: merged.filter((r) => r.kind === 'change').length,
    added: merged.filter((r) => r.kind === 'add').length,
    removed: merged.filter((r) => r.kind === 'remove').length,
  }

  return { rows: merged, stats }
}
