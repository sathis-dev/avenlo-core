import {
  KINETIC_WINDOW_SIZE,
  WindowMessage,
  buildAnalystMessages,
  parseAnalystResponse,
} from './kineticAnalysis';

const subjectId = 'user-123';

function makeWindow(): WindowMessage[] {
  return [
    {
      messageId: 'm1',
      authorId: 'other-1',
      username: 'alice',
      content: 'hey everyone',
      timestamp: '2026-05-29T10:00:00.000Z',
    },
    {
      messageId: 'm2',
      authorId: subjectId,
      username: 'mallory',
      content: 'we should all DM the new mods at once tonight',
      timestamp: '2026-05-29T10:01:00.000Z',
    },
  ];
}

describe('kineticAnalysis', () => {
  describe('buildAnalystMessages', () => {
    it('produces a system + user message pair', () => {
      const messages = buildAnalystMessages(makeWindow(), subjectId);
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
    });

    it('marks the subject and includes the transcript', () => {
      const [, userMessage] = buildAnalystMessages(makeWindow(), subjectId);
      expect(userMessage.content).toContain(`SUBJECT(mallory)`);
      expect(userMessage.content).toContain('DM the new mods');
      expect(userMessage.content).toContain('alice:');
    });

    it('exposes a window size of 7', () => {
      expect(KINETIC_WINDOW_SIZE).toBe(7);
    });
  });

  describe('parseAnalystResponse', () => {
    it('parses a well-formed threat verdict', () => {
      const raw = JSON.stringify({
        isThreat: true,
        vector: 'raid',
        severity: 'high',
        confidence: 0.82,
        recommendedAction: 'quarantine',
        signals: ['coordination language', 'targets new mods'],
        rationale: 'Coordinating a mass-DM raid on staff.',
      });
      const result = parseAnalystResponse(raw);
      expect(result).toEqual({
        isThreat: true,
        vector: 'raid',
        severity: 'high',
        confidence: 0.82,
        recommendedAction: 'quarantine',
        signals: ['coordination language', 'targets new mods'],
        rationale: 'Coordinating a mass-DM raid on staff.',
      });
    });

    it('clamps confidence into [0,1]', () => {
      expect(parseAnalystResponse(JSON.stringify({ confidence: 1.7 })).confidence).toBe(1);
      expect(parseAnalystResponse(JSON.stringify({ confidence: -3 })).confidence).toBe(0);
      expect(parseAnalystResponse(JSON.stringify({ confidence: 'nope' })).confidence).toBe(0);
    });

    it('coerces invalid enums to safe defaults', () => {
      const result = parseAnalystResponse(
        JSON.stringify({
          isThreat: false,
          vector: 'banana',
          severity: 'apocalyptic',
          recommendedAction: 'nuke',
          signals: 'not-an-array',
        })
      );
      expect(result.isThreat).toBe(false);
      expect(result.vector).toBe('toxicity');
      expect(result.severity).toBe('low');
      expect(result.recommendedAction).toBe('observe');
      expect(result.signals).toEqual([]);
      expect(result.rationale).toBe('No rationale provided.');
    });

    it('throws on malformed JSON', () => {
      expect(() => parseAnalystResponse('not json')).toThrow();
    });
  });
});
