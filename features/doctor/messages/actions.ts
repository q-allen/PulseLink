import { chatService } from "@/services/chatService";

export async function sendMessage(conversationId: string, senderId: string, content: string) {
  const res = await chatService.sendMessage(conversationId, senderId, "doctor", content, "text");
  return res.data;
}

export async function attachDocument(conversationId: string, senderId: string, documentId: string) {
  const res = await chatService.sendMessage(conversationId, senderId, "doctor", documentId, "file");
  return res.data;
}
