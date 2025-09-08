import { NextResponse } from 'next/server';
import { irysMinimalService } from '@/lib/irys-minimal';
import { priceOracle } from '@/lib/price-oracle';
import { envConfig } from '@/config/env';

export async function GET() {
  try {
    const healthChecks = [];

    // 1. Check environment configuration
    const envCheck = {
      name: 'Environment Configuration',
      status: 'healthy',
      details: {}
    };

    try {
      envCheck.details = {
        solanaRpcUrl: envConfig.solanaRpcUrl ? 'configured' : 'missing',
        solanaNetwork: envConfig.solanaNetwork,
        platformWallet: envConfig.platformWallet ? 'configured' : 'missing',
        serverWalletPrivateKey: envConfig.serverWalletPrivateKey ? 'configured' : 'missing',
        priceOracleUrl: envConfig.priceOracleUrl
      };

      if (!envConfig.platformWallet || !envConfig.serverWalletPrivateKey) {
        envCheck.status = 'unhealthy';
      }
    } catch {
      envCheck.status = 'unhealthy';
      envCheck.details = { error: 'Environment config load failed' };
    }

    healthChecks.push(envCheck);

    // 2. Check Irys service
    const irysCheck = {
      name: 'Irys Service',
      status: 'healthy',
      details: {} as Record<string, string>
    };

    try {
      const balance = await irysMinimalService.getBalance();
      irysCheck.details.balance = `${balance} SOL`;
      irysCheck.details.status = 'connected';
    } catch (error) {
      irysCheck.status = 'unhealthy';
      irysCheck.details = { error: error instanceof Error ? error.message : 'Irys connection failed' };
    }

    healthChecks.push(irysCheck);

    // 3. Check Price Oracle
    const oracleCheck = {
      name: 'Price Oracle',
      status: 'healthy',
      details: {} as Record<string, string>
    };

    try {
      const prices = await priceOracle.getCurrentPrices();
      const platformFee = await priceOracle.calculatePlatformFee();
      
      oracleCheck.details = {
        solPrice: `$${prices.solPrice}`,
        usdtPrice: `$${prices.usdtPrice}`,
        platformFee: `${platformFee.feeInUSDT} USDT = ${platformFee.feeInSOL} SOL`
      };
    } catch (error) {
      oracleCheck.status = 'unhealthy';
      oracleCheck.details = { error: error instanceof Error ? error.message : 'Price oracle failed' };
    }

    healthChecks.push(oracleCheck);

    // 4. Overall status
    const allHealthy = healthChecks.every(check => check.status === 'healthy');
    const overallStatus = allHealthy ? 'healthy' : 'degraded';

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: healthChecks
    });

  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed completely',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({ 
    message: 'Health endpoint only supports GET requests' 
  }, { status: 405 });
}