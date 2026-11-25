"""Record the Vault Checkout Agent demo video (sandbox).

Drives the local UI in Firefox with video recording on:
1. load the page
2. pick the YouTube service chip
3. quote a YouTube search (opens the price modal)
4. pay and run it from the modal (0.005 test USDC)
5. show the receipt + results
Saves a .webm in ~/workspace/celo-agent-vault-mainnet/demo/
"""
import time
from playwright.sync_api import sync_playwright

URL = "http://localhost:8787/"
OUT = "/home/hatch/workspace/celo-agent-vault-mainnet/demo"

with sync_playwright() as p:
    browser = p.firefox.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1280, "height": 800},
        record_video_dir=OUT,
        record_video_size={"width": 1280, "height": 800},
    )
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(1500)

    # The task: search YouTube for "celo" (X search provider 502s often).
    # Services are chips now (no #service select since the UI redesign).
    page.click('[data-cap="youtube.videos.search"]')
    page.fill("#query", "celo")
    page.wait_for_timeout(800)

    # Step 1: quote first - opens the price modal
    page.click("#quoteBtn")
    page.wait_for_selector("#quoteModal", state="visible", timeout=60000)
    page.wait_for_timeout(2000)

    # Step 2: pay and run from the modal
    page.click("#quotePayBtn")
    page.wait_for_selector("#receiptCard:not([style*='none'])", timeout=120000)
    page.wait_for_timeout(2500)
    page.wait_for_selector("#resultCard:not([style*='none'])", timeout=30000)
    page.wait_for_timeout(2500)

    # Scroll to show the ledger too
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(1500)

    ctx.close()
    browser.close()

    video = page.video.path() if page.video else None
    print("VIDEO:", video)
