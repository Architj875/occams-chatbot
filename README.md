# Occam's Chatbot

A specialized chatbot assistant for Occam's Advisory, built with React, Node.js, and Google's Gemini AI. This application provides a conversational interface to answer questions about Occam's Advisory using a Retrieval-Augmented Generation (RAG) approach.

![Occam's Chatbot](https://img.shields.io/badge/Occam's-Chatbot-purple)
![React](https://img.shields.io/badge/React-18.3.1-blue)
![Node.js](https://img.shields.io/badge/Node.js-Express-green)
![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini-red)

## 🌟 Features

- **AI-Powered Responses**: Utilizes Google's Gemini AI model to generate accurate, contextual responses
- **RAG Architecture**: Implements Retrieval-Augmented Generation to provide information grounded in Occam's Advisory content
- **Real-time Communication**: Socket.IO for instant messaging between client and server
- **Modern UI**: Sleek, responsive interface with smooth animations and markdown support
- **Contextual Understanding**: Processes and responds to complex queries about Occam's Advisory

## 📋 Prerequisites

- Node.js (v14 or higher)
- Google Gemini API key
- Scraped content from Occam's Advisory website (stored in the `pages-formatted` directory)

## 🚀 Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/occams-chatbot.git
   cd occams-chatbot
   ```

2. Install server dependencies:
   ```bash
   npm install
   ```

3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. Create a `.env` file in the root directory with your Google API key:
   ```
   GOOGLE_API_KEY=your_google_gemini_api_key_here
   PORT=3000
   ```

### Running the Application

1. Start the backend server:
   ```bash
   npm run dev
   ```

2. In a separate terminal, start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

## 🏗️ Project Structure

```
occams-chatbot/
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── App.tsx            # Main application component
│   │   ├── main.tsx           # Entry point
│   │   └── index.css          # Global styles
│   ├── public/                # Static assets
│   └── package.json           # Frontend dependencies
├── pages-formatted/           # Scraped and formatted content
├── server.js                  # Express server and Socket.IO setup
├── package.json               # Backend dependencies
└── .env                       # Environment variables (not in repo)
```

## 🧠 How It Works

1. **Data Preparation**: Content from Occam's Advisory website is scraped, processed, and stored in the `pages-formatted` directory
2. **RAG Implementation**: The application uses LangChain with Google Gemini to:
   - Index and retrieve relevant content based on user queries
   - Generate contextually appropriate responses using the retrieved information
3. **Real-time Communication**: Socket.IO enables instant messaging between the frontend and backend
4. **Response Rendering**: Markdown support allows for rich text formatting in bot responses

## 🛠️ Technologies Used

### Frontend
- React 18
- TypeScript
- Socket.IO Client
- React Markdown
- Lucide React (for icons)
- Tailwind CSS

### Backend
- Node.js
- Express
- Socket.IO
- LangChain
- Google Gemini 2.0 Flash
- dotenv

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 📞 Contact

Project Link: [https://github.com/yourusername/occams-chatbot](https://github.com/yourusername/occams-chatbot)

---

Built with ❤️ for Occam's Advisory
