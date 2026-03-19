const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function askAI(question, context) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are a highly intelligent technical support assistant for a software company.
      Your job is to answer the user's question using ONLY the documentation context provided below.
      
      RULES:
      - If the answer is not in the context, you MUST say: "I'm sorry, I cannot find the answer to that in the current documentation."
      - Do not make up answers. 
      - Keep your answer clear, professional, and easy to read.

      CONTEXT:
      ${context}

      USER QUESTION:
      ${question}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return response.text();
    
  } catch (error) {
    console.error("AI SDK Error:", error);
    return "Error: Could not connect to the AI. Check your API key and network.";
  }
}

module.exports = askAI;