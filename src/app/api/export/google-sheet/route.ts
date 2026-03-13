import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export async function POST(req: NextRequest) {
  try {
    const { data, title } = await req.json();

    const SPREADSHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || '1lVXJlWSFgkmcXTzBLnTzLX-gFXv_3dVxjd_foy-Rsx0';
    const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const GOOGLE_PRIVATE_KEY_RAW = process.env.GOOGLE_PRIVATE_KEY;
    const GOOGLE_PRIVATE_KEY = GOOGLE_PRIVATE_KEY_RAW?.replace(/\\n/g, '\n');

    console.log('Export API Check:', {
      hasEmail: !!GOOGLE_SERVICE_ACCOUNT_EMAIL,
      emailLength: GOOGLE_SERVICE_ACCOUNT_EMAIL?.length,
      hasKey: !!GOOGLE_PRIVATE_KEY_RAW,
      keyLength: GOOGLE_PRIVATE_KEY_RAW?.length,
    });

    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(
        { 
          error: 'Google Service Account credentials are not configured on the server.',
          debug: {
            emailFound: !!GOOGLE_SERVICE_ACCOUNT_EMAIL,
            keyFound: !!GOOGLE_PRIVATE_KEY_RAW
          }
        },
        { status: 500 }
      );
    }

    const serviceAccountAuth = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    const todayStr = format(new Date(), 'yyyy-MM-dd', { locale: ko });
    const sheetName = title ? `${todayStr}_${title}` : todayStr;

    let sheet = doc.sheetsByTitle[sheetName];
    
    if (!sheet) {
      sheet = await doc.addSheet({ title: sheetName });
    } else {
      await sheet.clear();
    }

    if (data && data.length > 0) {
      const headers = Object.keys(data[0]);
      await sheet.setHeaderRow(headers);
      await sheet.addRows(data);
    }

    return NextResponse.json({
      success: true,
      url: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${sheet.sheetId}`,
      sheetName
    });

  } catch (error: any) {
    console.error('API Google Sheet Export Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export to Google Sheet' },
      { status: 500 }
    );
  }
}
