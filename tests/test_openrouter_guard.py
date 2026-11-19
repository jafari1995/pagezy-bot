import pytest

from pagezy_bot.config import assert_model_is_free


def test_rejects_paid_model():
    with pytest.raises(ValueError):
        assert_model_is_free("anthropic/claude-3.5-sonnet")


def test_accepts_free_suffix():
    assert_model_is_free("google/gemma-2-9b-it:free")