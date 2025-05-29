export const mockResponses = [
  {
    content:
      "Based on your preferences, I'd recommend the Cherry MX Brown switches. They offer a tactile bump without being too loud, making them great for both typing and gaming. The actuation force is moderate at 45g, and they have a total travel distance of 4mm.",
    metadata: {
      category: 'recommendation',
      switches: ['Cherry MX Brown']
    }
  },
  {
    content:
      'Let me compare those switches for you. The Gateron Red has a lighter actuation force (45g) compared to the Kailh Box Black (60g). Gateron Reds are linear and smooth, ideal for gaming, while Box Blacks have a more substantial feel that some typists prefer. The Box Black also has better stability and dust resistance due to its box stem design.',
    metadata: {
      category: 'comparison',
      switches: ['Gateron Red', 'Kailh Box Black']
    }
  },
  {
    content:
      "For a quiet typing experience, I'd suggest looking at silent switches like the Zilent V2 or Healio V2. These switches use special dampeners to minimize both bottom-out and upstroke noise while maintaining a satisfying feel.",
    metadata: {
      category: 'recommendation',
      switches: ['Zilent V2', 'Healio V2']
    }
  }
];

let messageCounter = 0;

export function getRandomResponse(conversationId?: string) {
  const response = mockResponses[Math.floor(Math.random() * mockResponses.length)];
  messageCounter++;
  return {
    id: `${conversationId || 'msg'}-${messageCounter}`,
    role: 'assistant' as const,
    content: response.content,
    metadata: response.metadata,
    timestamp: new Date().toISOString()
  };
}

export const mockConversations = [
  {
    id: '1',
    title: 'Switch Recommendation Chat',
    userId: '8d813d95-a003-4d6a-8066-ea2d510f4a82',
    category: 'recommendation',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: '2',
    title: 'Switch Comparison Discussion',
    userId: '8d813d95-a003-4d6a-8066-ea2d510f4a82',
    category: 'comparison',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02')
  }
];
