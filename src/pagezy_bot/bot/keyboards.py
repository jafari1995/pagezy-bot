"""Minimal UI — single entry button."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def main_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[InlineKeyboardButton("تحلیل رقبا", callback_data="competitor_analysis")]])