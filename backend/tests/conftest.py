import pytest

from app.config import get_settings
from app.services.memory_store import memory_store


@pytest.fixture(autouse=True)
def reset_state():
    get_settings.cache_clear()
    memory_store.reset()
    yield
    memory_store.reset()
    get_settings.cache_clear()
