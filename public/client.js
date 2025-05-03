document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    const messages = document.getElementById('messages');
    const formInput = document.getElementById('m');
    const sendButton = document.getElementById('sendButton');
    const statusDiv = document.getElementById('status');
    const chatbox = document.getElementById('chatbox');

    const appendMessage = (msg, type) => {
        const item = document.createElement('li');
        item.textContent = msg;
        item.classList.add(type); // Add 'user' or 'bot' class
        messages.appendChild(item);
        chatbox.scrollTop = chatbox.scrollHeight; // Scroll to bottom
    };

    const sendMessage = () => {
        const messageText = formInput.value.trim();
        if (messageText) {
            appendMessage(`You: ${messageText}`, 'user'); // Display user message immediately
            socket.emit('user_message', messageText);
            formInput.value = '';
        }
    };

    sendButton.addEventListener('click', sendMessage);

    formInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    socket.on('connect', () => {
        console.log('Connected to server');
        // Status might be updated via 'status' event
    });

    socket.on('disconnect', () => {
        statusDiv.textContent = 'Disconnected from server.';
        statusDiv.style.color = 'red';
    });

    socket.on('status', (msg) => {
        statusDiv.textContent = msg;
        statusDiv.style.color = msg.includes('failed') ? 'red' : 'green';
    });


    socket.on('bot_response', (msg) => {
        appendMessage(`Bot: ${msg}`, 'bot');
    });

    socket.on('connect_error', (err) => {
      console.error("Connection Error:", err);
      statusDiv.textContent = 'Failed to connect to the server.';
      statusDiv.style.color = 'red';
    });
});