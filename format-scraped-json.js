import fs from 'fs/promises'; // Use promises version of fs
import path from 'path';
import { fileURLToPath } from 'url';

// Helper for directory path in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const INPUT_DIR = path.join(__dirname, 'pages-scraped'); // Directory with raw scraped JSONs
const OUTPUT_DIR = path.join(__dirname, 'pages-formatted'); // Directory for cleaned JSONs

// List of common boilerplate/navigation text patterns to remove (case-insensitive)
// Add more specific patterns based on observed noise in your scraped files
const REMOVE_PATTERNS = [
    /^read more$/i,
    /^browse all$/i,
    /^trustpilot$/i,
    /^(home|about|services|team|resources|contact|login|blogs|events|podcasts|webinar|insights|recognitions|testimonials|press release|privacy policy|terms and conditions|site map|get started)$/i,
    /^\d+$/, // Remove lines containing only numbers (likely pagination)
    /view all awards/i,
    /know more/i,
    /join our community/i,
    /let's partner/i,
    /connect with us/i,
    /know us better/i,
    /client resources/i,
    /corporate head office/i,
    /^© \d{4} Occams Advisory/i, // Copyright line
    // Add more specific, frequently occurring noise patterns here
];

// Minimum line length to keep (ignoring lines shorter than this after trimming)
const MIN_LINE_LENGTH = 5; // Adjust as needed

/**
 * Cleans and formats the raw text content extracted from a webpage.
 * @param {string} rawText - The raw text content.
 * @returns {string} - The cleaned and formatted text content.
 */
function formatPageContent(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        return '';
    }

    const lines = rawText.split('\n');
    const cleanedLines = [];
    let previousLine = null; // Keep track of the last line added

    for (const line of lines) {
        const trimmedLine = line.trim();

        // 1. Skip empty lines
        if (trimmedLine === '') {
            continue;
        }

        // 2. Skip very short lines (likely noise)
        if (trimmedLine.length < MIN_LINE_LENGTH) {
             continue;
        }

        // 3. Skip boilerplate/navigation patterns
        let skip = false;
        for (const pattern of REMOVE_PATTERNS) {
            if (pattern.test(trimmedLine)) {
                skip = true;
                break;
            }
        }
        if (skip) {
            continue;
        }

        // 4. Skip exact duplicate consecutive lines
        if (trimmedLine === previousLine) {
             continue;
        }

        // If line passes all checks, add it
        cleanedLines.push(trimmedLine);
        previousLine = trimmedLine; // Update the last added line
    }

    // Join the cleaned lines back with single newlines
    return cleanedLines.join('\n');
}

// --- Main Script Logic ---

async function runFormatter() {
    console.log("Starting JSON formatting process...");

    // 1. Ensure output directory exists
    try {
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        console.log(`Output directory ensured: ${OUTPUT_DIR}`);
    } catch (error) {
        console.error(`Error creating output directory ${OUTPUT_DIR}:`, error);
        return; // Stop if directory cannot be created
    }

    // 2. Read input directory
    let files;
    try {
        console.log(`Reading input directory: ${INPUT_DIR}`);
        files = await fs.readdir(INPUT_DIR);
    } catch (error) {
        console.error(`Error reading input directory ${INPUT_DIR}:`, error);
        return; // Stop if input directory cannot be read
    }

    const jsonFiles = files.filter(file => file.endsWith('.json'));
    console.log(`Found ${jsonFiles.length} JSON files in ${INPUT_DIR}.`);

    let processedCount = 0;
    let errorCount = 0;

    // 3. Process each JSON file
    for (const filename of jsonFiles) {
        const inputFilePath = path.join(INPUT_DIR, filename);
        const outputFilePath = path.join(OUTPUT_DIR, filename); // Save with same name in new dir

        try {
            // Read the raw JSON file
            const fileContent = await fs.readFile(inputFilePath, 'utf-8');
            const jsonData = JSON.parse(fileContent);

            // Check if required keys exist
            if (!jsonData.url || typeof jsonData.page_content !== 'string') {
                console.warn(` -> Skipping ${filename}: Missing 'url' or 'page_content' is not a string.`);
                continue; // Skip this file
            }

            // Format the page content
            const cleanedContent = formatPageContent(jsonData.page_content);

            // Create the new JSON structure
            const outputData = {
                url: jsonData.url,
                scraped_at: jsonData.scraped_at || new Date().toISOString(),
                page_content: cleanedContent // Use the cleaned content
            };

            // Write the cleaned JSON to the output directory
            await fs.writeFile(outputFilePath, JSON.stringify(outputData, null, 2), 'utf-8'); // Pretty print
            // console.log(` -> Formatted and saved ${filename} to ${OUTPUT_DIR}`); // Optional: Log each success
            processedCount++;

        } catch (error) {
            console.error(` -> Error processing file ${filename}: ${error.message}`);
            errorCount++;
        }
    }

    console.log("\nFormatting process finished.");
    console.log(`Successfully processed: ${processedCount} files.`);
    console.log(`Errors encountered: ${errorCount} files.`);
}

// Run the main function
runFormatter();
