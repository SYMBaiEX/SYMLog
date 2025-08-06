// Test script for the chat API
// Run with: node test-chat-api.js

async function testChatAPI() {
  console.log('Testing chat API...');

  // You'll need to replace this with a valid JWT token
  const testToken = 'YOUR_TEST_TOKEN_HERE';

  try {
    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        messages: [
          {
            id: '1',
            role: 'user',
            parts: [{ type: 'text', text: 'Hello, how are you?' }],
          },
        ],
        model: 'gpt-3.5-turbo',
        systemPromptType: 'default',
      }),
    });

    if (!response.ok) {
      console.error('Error:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }

    // Read the streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    console.log('Reading streaming response...');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      process.stdout.write(chunk);
    }

    console.log('\n\nTest completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testChatAPI();
