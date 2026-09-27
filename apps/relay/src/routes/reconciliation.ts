import { Hono } from 'hono';
import { auditSettlement } from '../reconciliation/audit';
import { relayStore } from '../db';
import type { ChannelCode } from '@logixsoft/relay-schema';

export const reconciliationRouter = new Hono();

async function handleUploadSettlement(c: any) {
  const contentType = c.req.header('content-type') || '';
  let csvContent = '';
  let outletId = 'outlet_default';
  let channelCode: ChannelCode = 'SWIGGY';
  let payoutReference: string | undefined = undefined;

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (file) {
      csvContent = await file.text();
    } else {
      csvContent = (formData.get('csv') as string) || '';
    }
    outletId = (formData.get('outletId') as string) || outletId;
    channelCode = ((formData.get('channelCode') as string) || 'SWIGGY').toUpperCase() as ChannelCode;
    payoutReference = (formData.get('payoutReference') as string) || undefined;
  } else {
    const body = await c.req.json();
    csvContent = body.csvContent || body.csv || '';
    outletId = body.outletId || outletId;
    channelCode = (body.channelCode || 'SWIGGY').toUpperCase() as ChannelCode;
    payoutReference = body.payoutReference;
  }

  if (!csvContent) {
    return c.json({ error: 'Bad Request', message: 'csvContent or file is required' }, 400);
  }

  const auditResult = await auditSettlement({
    outletId,
    channelCode,
    csvContent,
    payoutReference,
  });

  return c.json({
    success: true,
    summary: auditResult,
  });
}

// ─── POST /reconciliation/upload-settlement ───────────────────────────────────
reconciliationRouter.post('/upload-settlement', (c) => handleUploadSettlement(c));

// OpenAPI Spec Alias: POST /reconciliation/upload
reconciliationRouter.post('/upload', (c) => handleUploadSettlement(c));

// ─── GET /reconciliation/discrepancies ────────────────────────────────────────
reconciliationRouter.get('/discrepancies', async (c) => {
  const outletId = c.req.query('outletId');
  const discrepancies = await relayStore.getSettlementDiscrepancies(outletId);
  return c.json({
    total: discrepancies.length,
    discrepancies,
  });
});

// ─── GET /reconciliation/summary ──────────────────────────────────────────────
reconciliationRouter.get('/summary', async (c) => {
  const outletId = c.req.query('outletId');
  const settlements = await relayStore.listSettlements(outletId);

  const totalGross = settlements.reduce((acc, s) => acc + (s.grossAmount || 0), 0);
  const totalCommission = settlements.reduce((acc, s) => acc + (s.commissionDeductions || 0), 0);
  const totalNet = settlements.reduce((acc, s) => acc + (s.netPayout || 0), 0);
  const totalDiscrepancies = settlements.reduce((acc, s) => acc + (s.discrepancyAmount || 0), 0);

  return c.json({
    totalSettlements: settlements.length,
    totalGross,
    totalCommission,
    totalNet,
    totalDiscrepancyAmount: totalDiscrepancies,
    settlements,
  });
});
