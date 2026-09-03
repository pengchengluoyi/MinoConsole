# IAM (Console)

Console owns **login identities** and **account roles**. It does not own model API keys or plugin credentials.

## Account roles

Only two roles:

| Role | Label | Console | Studio |
|---|---|---|---|
| `admin` | 管理员 | Full access (username/password login only) | Full access |
| `user` | 用户 | **Cannot log in** | Email login / register |

Legacy Nexus roles map: `platform_admin`/`org_admin` → `admin`; `qa_lead`/`operator`/`viewer` → `user`.

## Login matrix

| Client | Header | Method | Who |
|---|---|---|---|
| Console | `X-Mino-Client: console` | Username + password | `admin` only (non-admin → 403) |
| Studio | `X-Mino-Client: studio` | Email + password | `admin` or `user` |

Studio email registration does **not** require captcha or email verification code. Checks: valid email format, email not already registered.

`GET /me/bootstrap` returns session, capabilities, and studio nav. Console also gates on `GET /auth/status` with the console client header.
