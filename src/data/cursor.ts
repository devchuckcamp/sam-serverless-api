interface CursorData {
  PK: string;
  SK: string;
}

export function encodeCursor(lastEvaluatedKey: Record<string, unknown>): string {
  const cursorData: CursorData = {
    PK: lastEvaluatedKey['PK'] as string,
    SK: lastEvaluatedKey['SK'] as string,
  };
  const json = JSON.stringify(cursorData);
  return Buffer.from(json, 'utf-8').toString('base64url');
}

export function decodeCursor(cursor: string): Record<string, string> | undefined {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    const cursorData = JSON.parse(json) as CursorData;

    if (
      typeof cursorData.PK !== 'string' ||
      typeof cursorData.SK !== 'string' ||
      !cursorData.PK.startsWith('CLINIC#') ||
      !cursorData.SK.startsWith('NOTE#')
    ) {
      return undefined;
    }

    return {
      PK: cursorData.PK,
      SK: cursorData.SK,
    };
  } catch {
    return undefined;
  }
}
