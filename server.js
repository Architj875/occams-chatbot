import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs'; // Node.js File System module (sync methods used during init)

// Langchain specific imports
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
// **REMOVED**: Puppeteer loader no longer needed here
// **REMOVED**: JSONLoader might not be needed if we read/parse manually
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { Document } from "@langchain/core/documents";
import { MultiQueryRetriever } from "langchain/retrievers/multi_query";

// --- Basic Setup ---
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
// **CHANGED**: Define paths for data folders
const SCRAPED_PAGES_DIR = path.join(__dirname, "pages-formatted"); // Folder with scraped JSONs
const RESEARCH_DOC_FILENAME = "Occam's Advisory Website Research.txt"; // Research text file
const researchDocPath = path.join(__dirname, RESEARCH_DOC_FILENAME);

// --- Langchain RAG Chain Setup ---
let retrievalChain;

/**
 * Initializes the Langchain RAG chain by loading pre-scraped JSON files and the research document.
 */
async function initializeLangchain() {
    console.log("Initializing Langchain RAG chain with Google Gemini (loading pre-scraped JSONs)...");

    if (!GOOGLE_API_KEY) {
        console.error("❌ Google API Key not found in environment variables (GOOGLE_API_KEY).");
        throw new Error("Missing Google API Key.");
    }

    try {
        // 1. Load Documents
        const allDocs = [];
        let scrapedDocsCount = 0;

        // a) **CHANGED**: Load all JSON files from the pages-scraped directory
        console.log(`Loading scraped page data from directory: ${SCRAPED_PAGES_DIR}`);
        try {
            // Check if the directory exists
            if (!fs.existsSync(SCRAPED_PAGES_DIR)) {
                 console.warn(`⚠️ Directory not found: ${SCRAPED_PAGES_DIR}. No scraped pages will be loaded.`);
            } else {
                // Read all files in the directory
                const files = fs.readdirSync(SCRAPED_PAGES_DIR);
                // Filter for files ending with .json
                const jsonFiles = files.filter(file => file.endsWith('.json'));
                console.log(`Found ${jsonFiles.length} JSON files to process.`);

                // Process each JSON file
                for (const file of jsonFiles) {
                    const filePath = path.join(SCRAPED_PAGES_DIR, file);
                    try {
                        // Read the file content
                        const fileContent = fs.readFileSync(filePath, 'utf-8');
                        // Parse the JSON content
                        const jsonData = JSON.parse(fileContent);

                        // Expecting {"url": "...", "page_content": "..."} structure from scraper script
                        if (jsonData.page_content && typeof jsonData.page_content === 'string' && jsonData.url) {
                            // Create a Langchain Document object
                            const doc = new Document({
                                pageContent: jsonData.page_content,
                                metadata: {
                                    source: file, // Use filename as the source identifier
                                    url: jsonData.url, // Store the original URL from scraping
                                    scraped_at: jsonData.scraped_at || new Date().toISOString(), // Store scrape time if available
                                    type: "scraped_page_json" // Indicate the type of source
                                }
                            });
                            allDocs.push(doc); // Add the document to our list
                            scrapedDocsCount++;
                            // console.log(` -> Loaded content from ${file}`); // Optional: Log each file successfully loaded
                        } else {
                            // Warn if the expected keys are missing or page_content isn't a string
                            console.warn(` -> Skipping ${file}: Missing 'url' or 'page_content' key, or 'page_content' is not a string.`);
                        }
                    } catch (parseError) {
                        // Log errors during file reading or JSON parsing
                        console.error(` -> Error processing ${file}: ${parseError.message}`);
                    }
                }
                console.log(`Successfully loaded content from ${scrapedDocsCount} JSON files.`);
            }
        } catch (readDirError) {
             // Log errors if the directory itself cannot be read
             console.error(`❌ Error reading directory ${SCRAPED_PAGES_DIR}: ${readDirError.message}`);
             // Continue without scraped pages if directory read fails
        }

        // b) Load the research document file
        let researchDocCount = 0;
        try {
            console.log(`Reading research document from: ${researchDocPath}`);
            // Check if the research file exists
            if (!fs.existsSync(researchDocPath)) {
                 console.warn(`⚠️ Research document not found: ${researchDocPath}.`);
            } else {
                // Read the research file content
                const researchDocumentText = fs.readFileSync(researchDocPath, 'utf-8');
                // Create a Langchain Document object
                const researchDoc = new Document({
                    pageContent: researchDocumentText,
                    metadata: { source: RESEARCH_DOC_FILENAME, type: "research_summary", topic: "Company Overview and Analysis" }
                });
                allDocs.push(researchDoc); // Add the research document to our list
                researchDocCount = 1;
                console.log("Research document loaded and added.");
            }
        } catch (fileError) {
            // Log errors during research file reading
            console.error(`❌ Error reading research document file (${RESEARCH_DOC_FILENAME}): ${fileError.message}`);
        }

        // c) Final check on all loaded documents
        if (!allDocs || allDocs.length === 0) {
            // Throw an error if absolutely no documents could be loaded
            throw new Error("Failed to load any documents (scraped JSONs or research file). Ensure scraper ran and files exist.");
        }
        console.log(`Total documents loaded for processing: ${allDocs.length} (${scrapedDocsCount} from JSON, ${researchDocCount} from research file).`);

        // 2. Split Documents
        console.log("Splitting all documents into chunks...");
        // Use the same chunking strategy as before
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1500, chunkOverlap: 300 });
        const splitDocs = await splitter.splitDocuments(allDocs);
        console.log(`Split into ${splitDocs.length} chunks.`);

        // 3. Create Embeddings & Vector Store
        console.log("Creating Google GenAI embeddings and vector store (in-memory)...");
        const embeddings = new GoogleGenerativeAIEmbeddings({ apiKey: GOOGLE_API_KEY, modelName: "embedding-001" });
        // Create the vector store from the split documents
        const vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);
        console.log("Vector store created.");

        // 4. Initialize LLM (for Retriever & Chain)
        console.log("Initializing Google GenAI Chat Model (for Retriever & Chain)...");
        let chatModel;
        try {
            // Initialize the chat model to be used
            chatModel = new ChatGoogleGenerativeAI({ apiKey: GOOGLE_API_KEY, model: "gemini-2.0-flash", temperature: 0.1 });
            console.log("Chat Model instance created.");
        } catch (initError) {
            console.error("❌ Error during ChatGoogleGenerativeAI instantiation:", initError);
            throw initError; // Stop initialization if model fails
        }

        // 5. Create MultiQuery Retriever
        console.log("Creating MultiQuery Retriever...");
        // Base retriever fetches from the vector store containing all loaded docs
        const baseRetriever = vectorStore.asRetriever( { k: 6 } ); // Retrieve 6 docs per query variation
        // MultiQueryRetriever uses the LLM to generate query variations
        const retriever = MultiQueryRetriever.fromLLM({
            llm: chatModel,
            retriever: baseRetriever,
            verbose: true, // Log generated queries for debugging
        });
        console.log("MultiQuery Retriever created.");

        // 6. Define Prompt Template
        const prompt = ChatPromptTemplate.fromTemplate(`You are a friendly and professional assistant representing Occam's Advisory.
**IMPORTANT:** In the user's question, terms like "the company", "the firm", "this organization", or similar generic references should be understood to mean "Occam's Advisory".

Your primary goal is to answer user questions accurately and helpfully, using *only* the information contained in the provided context documents (these documents are based on the Occam's Advisory website content and a research summary).

Please follow these instructions carefully:
1.  Read the user's question and all the provided context documents thoroughly.
2.  Answer the question based *strictly* on the information found in the context. Do not add any external knowledge or make assumptions.
3.  Synthesize information from across the context documents to provide a comprehensive answer whenever possible, especially for general questions about Occam's Advisory.
4.  Prioritize providing details for common inquiries about Occam's Advisory, such as its mission, services, target clients (MSMEs), history, philosophy (Occam's Razor, O.C.C.A.M.S values), leadership, or contact information, *if* the context supports it.
5.  If relevant information about the question's topic IS PRESENT in the context (even if it refers to "Occam's Advisory" and the question uses "the company"), USE that information to formulate the best possible answer based *only* on what is provided.
6.  Only if the context documents genuinely DO NOT contain *any* relevant information related to Occam's Advisory that could address the user's question, should you politely state that the specific detail isn't available. You could say something like: "Based on the available Occam's Advisory materials, I don't have specific information on [topic of question]. Is there something else I can help you find?"
7.  Maintain a helpful and professional tone.

Context:
{context}

Question: {input}`);
        // Updated prompt slightly to reflect source material

        // 7. Create the "Stuff" Chain
        console.log("Creating Stuff Documents Chain...");
        const combineDocsChain = await createStuffDocumentsChain({ llm: chatModel, prompt: prompt });
        console.log("Stuff Documents Chain created.");

        // 8. Create the Retrieval Chain
        console.log("Creating Retrieval Chain...");
        // The final chain uses the MultiQueryRetriever
        retrievalChain = await createRetrievalChain({ retriever: retriever, combineDocsChain: combineDocsChain });
        console.log("Retrieval Chain created.");

        console.log("✅ Langchain RAG Chain Initialized Successfully with Google Gemini!");

    } catch (error) {
        console.error("❌ Fatal Error during Langchain initialization with Google Gemini:", error);
        retrievalChain = null; // Ensure chain is null on error
        if (error instanceof Error) { throw error; } // Re-throw error
        else { throw new Error(String(error)); }
    }
}

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "http://localhost:5000",
    methods: ["GET", "POST"]
  }
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Basic route for the root path to serve the HTML interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Socket.IO Connection Handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send status update to the newly connected client
    if (retrievalChain) {
        socket.emit('status', 'Chatbot is ready. Ask your question!');
    } else {
        socket.emit('status', 'Error: Chatbot is not available. Initialization failed.');
    }

    // Handle client disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });

    // Listen for messages from the client
    socket.on('user_message', async (msg) => {
        console.log(`Message received from ${socket.id}: ${msg}`);

        // Check if the RAG chain is ready
        if (!retrievalChain) {
            socket.emit('bot_response', 'Sorry, the chatbot is currently unavailable due to an initialization error.');
            return;
        }

        // Basic input validation
        if (!msg || typeof msg !== 'string' || msg.trim().length === 0) {
             socket.emit('bot_response', 'Please enter a valid question.');
             return;
        }

        const cleanMsg = msg.trim();

        try {
            console.log(`Invoking Gemini RAG chain for query: "${cleanMsg}"`);
            // Invoke the retrieval chain with the user's input
            const result = await retrievalChain.invoke({ input: cleanMsg });

            // **DEBUGGING**: Log the retrieved context documents
            console.log("--- Retrieved Context Start ---");
            if (result.context && result.context.length > 0) {
                result.context.forEach((doc, index) => {
                    console.log(`Context Doc ${index + 1}:`);
                    console.log(`  Content: ${doc.pageContent.substring(0, 300)}...`); // Log beginning of content
                    console.log(`  Metadata: ${JSON.stringify(doc.metadata)}`); // Log metadata
                });
            } else {
                console.log("No context documents were retrieved.");
            }
            console.log("--- Retrieved Context End ---");


            // Extract the answer from the result, providing a default if missing
            const answer = result?.answer ?? "Sorry, I encountered an issue processing your request.";

            // Send the answer back to the client
            console.log(`Sending response to ${socket.id}: ${answer}`);
            socket.emit('bot_response', answer);

        } catch (error) {
            // Handle errors during chain invocation
            console.error(`Error invoking Langchain/Gemini chain for ${socket.id}:`, error);
             if (error.message && error.message.includes('SAFETY')) {
                 // Handle specific safety errors from Gemini
                 socket.emit('bot_response', 'The response was blocked due to safety settings.');
             } else {
                 // Send a generic error message for other issues
                 socket.emit('bot_response', 'Sorry, an error occurred while trying to answer your question.');
             }
        }
    });
});

// --- Start Server ---
async function startServer() {
    try {
        // Initialize the Langchain components before starting the server
        await initializeLangchain();
        // Start the server listening on the configured port
        server.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log("Gemini Chatbot is active and listening for connections.");
        });
    } catch (error) {
        // Log fatal errors during startup and exit
        console.error("❌ Failed to start server due to Langchain/Gemini initialization error.");
        process.exit(1); // Exit the process if initialization fails
    }
}

// --- Run the server ---
startServer();