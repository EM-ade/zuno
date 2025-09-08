import { NextRequest, NextResponse } from 'next/server';
import { testCollectionData, sampleCandyMachineResponse, errorResponse } from '@/utils/test-data';

// Test endpoint to simulate the create-collection API
export async function POST(request: NextRequest) {
  try {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get test mode from query params
    const url = new URL(request.url);
    const testMode = url.searchParams.get('testMode');
    
    if (testMode === 'error') {
      return NextResponse.json(errorResponse, { status: 500 });
    }

    if (testMode === 'validation') {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: collectionName, totalSupply' },
        { status: 400 }
      );
    }

    // Return successful response
    return NextResponse.json(sampleCandyMachineResponse);

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Test error occurred' 
      },
      { status: 500 }
    );
  }
}

// Test endpoint documentation
export async function GET() {
  return NextResponse.json({
    description: 'Test endpoint for /api/create-collection',
    endpoints: [
      {
        method: 'POST',
        url: '/api/create-collection/test',
        description: 'Simulates successful collection creation'
      },
      {
        method: 'POST',
        url: '/api/create-collection/test?testMode=error',
        description: 'Simulates API error response'
      },
      {
        method: 'POST',
        url: '/api/create-collection/test?testMode=validation',
        description: 'Simulates validation error response'
      }
    ],
    sampleRequest: testCollectionData,
    sampleResponse: sampleCandyMachineResponse
  });
}