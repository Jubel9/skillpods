document.addEventListener('DOMContentLoaded', () => {
    // --- SECTIONS ---
    const registrationSection = document.getElementById('registration-section');
    const interviewSection = document.getElementById('interview-section');
    
    // --- REGISTRATION ELEMENTS ---
    const registrationForm = document.getElementById('registration-form');

    // --- INTERVIEW ELEMENTS ---
    const chatMessages = document.getElementById('chat-messages');
    const playerResponseInput = document.getElementById('player-response');
    const sendResponseButton = document.getElementById('send-response');

    // --- STATE ---
    let conversationHistory = [];

    // --- REGISTRATION LOGIC ---
    registrationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Registration failed');
            
            // On success, hide registration and start interview
            registrationSection.classList.add('hidden');
            interviewSection.classList.remove('hidden');
            startInterview();

        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    // --- INTERVIEW LOGIC ---
    const addMessage = (sender, text) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', `${sender}-message`);
        messageElement.innerText = text;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll
    };

    // This is the main function for getting a response from the AI
    async function getAiResponse() {
        playerResponseInput.disabled = true;
        sendResponseButton.disabled = true;

        try {
            const response = await fetch('http://localhost:3000/api/interview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversation: conversationHistory }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to get response from AI.');

            if (data.summary) {
                const summaryText = `Thank you! I've created your profile summary.\n\nSummary:\n${JSON.stringify(data.summary, null, 2)}`;
                addMessage('ai', summaryText);
                // Keep input disabled, interview is over.
            } else {
                addMessage('ai', data.message);
                conversationHistory.push({ role: 'assistant', content: data.message });
                playerResponseInput.disabled = false;
                sendResponseButton.disabled = false;
                playerResponseInput.focus();
            }

        } catch (error) {
            addMessage('ai', `Sorry, an error occurred: ${error.message}`);
        }
    }

    // When the interview starts, we clear the history and immediately ask the AI for the first question.
    const startInterview = () => {
        conversationHistory = [];
        getAiResponse();
    };

    const handlePlayerInput = async () => {
        const playerMessage = playerResponseInput.value.trim();
        if (!playerMessage) return;

        addMessage('player', playerMessage);
        conversationHistory.push({ role: 'user', content: playerMessage });
        playerResponseInput.value = '';

        await getAiResponse();
    };



    sendResponseButton.addEventListener('click', handlePlayerInput);
    playerResponseInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handlePlayerInput();
    });
});