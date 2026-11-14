from alembic import context
from sqlalchemy import create_engine

from timewise_api.db import database_url

# Offline mode (--sql) only prints the SQL, so it works without a database.
if context.is_offline_mode():
    context.configure(url="postgresql+psycopg://offline/offline", literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = create_engine(database_url())
    with engine.connect() as connection:
        context.configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()
