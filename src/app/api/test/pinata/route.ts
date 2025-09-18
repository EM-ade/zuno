import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Pinata Configuration Test ===');
    
    // Check environment variables
    const pinataJwt = process.env.PINATA_JWT;
    const pinataGateway = process.env.PINATA_GATEWAY;
    
    const results = {
      pinataJwtExists: !!pinataJwt,
      pinataJwtLength: pinataJwt ? pinataJwt.length : 0,
      pinataJwtValid: pinataJwt ? pinataJwt.startsWith('eyJ') : false,
      pinataGatewayExists: !!pinataGateway,
      pinataGatewayValue: pinataGateway ? `${pinataGateway.substring(0, 20)}...` : 'undefined',
      pinataGatewayValid: pinataGateway ? pinataGateway.includes('.') : false,
      availablePinataEnvVars: Object.keys(process.env).filter(key => key.includes('PINATA'))
    };
    
    console.log('Pinata configuration check:', results);
    
    // Try to initialize Pinata service
    let pinataServiceStatus = 'unknown';
    try {
      const { pinataService } = await import('@/lib/pinata-service');
      pinataServiceStatus = 'initialized successfully';
    } catch (error) {
      pinataServiceStatus = `initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Pinata configuration test completed',
        results: {
          ...results,
          pinataServiceStatus
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Pinata test error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Test failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
