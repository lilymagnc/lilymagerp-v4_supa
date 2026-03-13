export async function exportToGoogleSheet(data: any[], title?: string) {
  try {
    const response = await fetch('/api/export/google-sheet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data, title }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to export to Google Sheet');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Google Sheet Export Client Error:', error);
    throw error;
  }
}
