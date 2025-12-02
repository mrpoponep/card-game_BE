// Server/services/ChatModerationAIService.js
import axios from 'axios';

const AI_BASE_URL = process.env.AI_MODERATION_URL || 'http://localhost:8000';

class ChatModerationAIService {
  /**
   * conversation: array message
   * [
   *   { timestamp: '2025-11-26 10:05:14', player: 'Alice', text: 'dm mày' },
   *   ...
   * ]
   */
  static async analyzeConversation(conversation) {
    try {
      const response = await axios.post(`${AI_BASE_URL}/analyze`, {
        messages: conversation,
      });

      return response.data; // { violations: [...] }
    } catch (error) {
      console.error('❌ Error calling AI moderation service:', error.message);
      if (error.response) {
        console.error('AI response data:', error.response.data);
      }
      throw new Error('AI moderation service error');
    }
  }
}

export default ChatModerationAIService;
