import fs from 'fs/promises'; // Use promises version of fs
import path from 'path';
import puppeteer from 'puppeteer'; // Use puppeteer directly for scraping
import { fileURLToPath } from 'url';

// Helper for directory path in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const ABOUT_JSON_PATH = path.join(__dirname, 'pages-scraped', 'about.json'); // Path to your structured JSON
const OUTPUT_DIR = path.join(__dirname, 'pages-scraped');
const BASE_URL = "https://www.occamsadvisory.com"; // Base URL to filter internal links

// --- Helper Functions ---

/**
 * Recursively extracts unique URLs from the navigation/link structures in the JSON data.
 * @param {any} data - The JSON data (object or array).
 * @param {Set<string>} urls - A Set to store unique URLs found so far.
 */
function extractUrlsFromJson(data, urls) {
    if (typeof data === 'string' && data.startsWith(BASE_URL)) {
        // Basic check to see if it looks like a relevant URL
        try {
            const url = new URL(data); // Validate URL structure
            // Avoid anchor links within the same page and login/portal links
            if (url.origin === BASE_URL && !url.pathname.includes('login') && !url.pathname.includes('portal') && !url.hash) {
                 urls.add(url.href);
            }
        } catch (e) {
             // Ignore invalid URLs
        }

    } else if (Array.isArray(data)) {
        data.forEach(item => extractUrlsFromJson(item, urls));
    } else if (typeof data === 'object' && data !== null) {
        for (const key in data) {
            // Specifically look in 'href' keys, but also check other string values
            if (key === 'href' || typeof data[key] === 'string') {
                extractUrlsFromJson(data[key], urls);
            } else if (typeof data[key] === 'object') { // Recurse into nested objects/arrays
                extractUrlsFromJson(data[key], urls);
            }
        }
    }
}

/**
 * Scrapes the main text content of a given URL using Puppeteer.
 * @param {puppeteer.Browser} browser - The Puppeteer browser instance.
 * @param {string} url - The URL to scrape.
 * @returns {Promise<string|null>} - The extracted text content or null if failed.
 */
async function scrapePageContent(browser, url) {
    let page; // Declare page variable outside try block
    try {
        page = await browser.newPage();
        console.log(`  Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); // Increased timeout

        console.log(`  Extracting text from ${url}...`);
        // Attempt to extract text primarily from common main content containers
        // Fallback to body if specific containers aren't found
        const textContent = await page.evaluate(() => {
            const mainContentSelectors = ['main', 'article', '.content', '.main-content', '#content', '#main'];
            let mainElement = null;
            for (const selector of mainContentSelectors) {
                 mainElement = document.querySelector(selector);
                 if (mainElement) break;
            }
            const targetElement = mainElement || document.body; // Use main element or fallback to body
            // Remove script, style, nav, header, footer tags before extracting text
            targetElement.querySelectorAll('script, style, nav, header, footer, .nav, .footer, .header, .menu, #nav, #footer, #header, #menu').forEach(el => el.remove());
            return targetElement.innerText;
        });

        await page.close(); // Close the page after extraction
        console.log(`  Successfully extracted text from ${url}. Length: ${textContent?.length}`);
        return textContent?.trim() || null; // Return trimmed text or null

    } catch (error) {
        console.error(`  Error scraping ${url}: ${error.message}`);
        if (page && !page.isClosed()) {
            await page.close(); // Ensure page is closed on error
        }
        return null; // Indicate failure
    }
}

/**
 * Generates a safe filename from a URL.
 * @param {string} url - The URL.
 * @returns {string} - A filesystem-safe filename ending in .json.
 */
function urlToFilename(url) {
    try {
        const parsedUrl = new URL(url);
        let pathname = parsedUrl.pathname;
        // Remove leading/trailing slashes, replace slashes with underscores
        pathname = pathname.replace(/^\/|\/$/g, '').replace(/\//g, '_');
        // Handle root path
        if (!pathname) {
            pathname = 'index';
        }
        // Remove invalid filename characters and ensure it ends with .json
        return pathname.replace(/[^a-z0-9_-]/gi, '_').substring(0, 100) + '.json'; // Limit length
    } catch (e) {
        // Fallback for invalid URLs
        return `invalid_url_${Date.now()}.json`;
    }
}


// --- Main Script Logic ---

async function runScraper() {
    console.log("Starting scraping process...");

    // 1. Ensure output directory exists
    try {
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        console.log(`Output directory ensured: ${OUTPUT_DIR}`);
    } catch (error) {
        console.error(`Error creating output directory ${OUTPUT_DIR}:`, error);
        return; // Stop if directory cannot be created
    }

    // 2. Read and parse the about.json file to find URLs
    let aboutData;
    try {
        console.log(`Reading URL source file: ${ABOUT_JSON_PATH}`);
        const aboutJsonContent = await fs.readFile(ABOUT_JSON_PATH, 'utf-8');
        aboutData = JSON.parse(aboutJsonContent);
        console.log("Successfully read and parsed about.json.");
    } catch (error) {
        console.error(`Error reading or parsing ${ABOUT_JSON_PATH}:`, error);
        return; // Stop if the source file is invalid
    }

    // 3. Extract unique URLs
    const urlsToScrape = new Set();
    extractUrlsFromJson(aboutData, urlsToScrape);
    // Add base URL if not already present, as it might have unique content
    urlsToScrape.add(BASE_URL + "/");
    // Add any other known important URLs manually if needed
    // urlsToScrape.add("https://www.occamsadvisory.com/some-other-page/");

    console.log(`Found ${urlsToScrape.size} unique URLs to scrape.`);
    if (urlsToScrape.size === 0) {
        console.log("No URLs found to scrape. Exiting.");
        return;
    }

    // 4. Launch Puppeteer
    let browser;
    try {
        console.log("Launching Puppeteer browser...");
        browser = await puppeteer.launch({ headless: true });
        console.log("Browser launched.");

        // 5. Scrape each URL and save content
        for (const url of urlsToScrape) {
            console.log(`Processing URL: ${url}`);
            const textContent = await scrapePageContent(browser, url);

            if (textContent) {
                const filename = urlToFilename(url);
                const filepath = path.join(OUTPUT_DIR, filename);
                const jsonData = JSON.stringify({
                    url: url,
                    scraped_at: new Date().toISOString(),
                    page_content: textContent // Store the extracted text
                }, null, 2); // Pretty print JSON

                try {
                    await fs.writeFile(filepath, jsonData, 'utf-8');
                    console.log(`  -> Saved content to ${filename}`);
                } catch (writeError) {
                    console.error(`  -> Error saving file ${filename}: ${writeError.message}`);
                }
            } else {
                console.log(`  -> Skipping save for ${url} due to scraping error or no content.`);
            }
            // Optional: Add a small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
        }

    } catch (error) {
        console.error("An error occurred during the scraping process:", error);
    } finally {
        if (browser) {
            console.log("Closing Puppeteer browser...");
            await browser.close();
            console.log("Browser closed.");
        }
    }

    console.log("Scraping process finished.");
}

// Run the main function
runScraper();
