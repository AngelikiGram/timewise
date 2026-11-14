# Deployment

Status: **Planned.** Nothing has been deployed. The web app still runs from local JSON.

## Development database (hosted PostGIS)

1. Create a Supabase project in an EU region, such as Frankfurt, and check the current plan and limits as you do. The free plan should be enough for development.
2. Save the database password somewhere safe.
3. In the project, open **Connect** and copy the **Session pooler** connection string. The direct connection is IPv6-only on most networks.
4. Copy `.env.example` to `.env` at the repo root and set `DATABASE_URL`, with your password in place. If the password has special characters, URL-encode them. Don't paste it into chat, and don't commit `.env`.

Then, from the repo root:

```bash
.venv/Scripts/python -m pip install -r apps/api/requirements.txt
```

```bash
cd apps/api && ../../.venv/Scripts/python -m alembic upgrade head
```

```bash
cd apps/api && ../../.venv/Scripts/python -m timewise_api.seed austria
```

```bash
.venv/Scripts/python -m pytest tests/py
```

To run the API locally on port 8000:

```bash
cd apps/api && ../../.venv/Scripts/python -m uvicorn timewise_api.main:app --port 8000
```

The tests write seed data to whatever `DATABASE_URL` points at, so use a development database only.

After changing curated data, run `npm run sync:db`, then rebuild the site. It applies migrations, seeds, and writes the export the site is built from.

## Production (not started)

The web app and the API need separate hosting, and staging and production need separate databases. See spec section 17.
