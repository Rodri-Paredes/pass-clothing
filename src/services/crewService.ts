import { supabase } from '../lib/supabase';
import type { CustomerAccountLinkRequest, CrewBenefitDefinition, CrewContext, CrewMembership, CrewMembershipRequest, CrewPlan, CrewSaleQuote } from '../lib/types';

const fail = (error: { message: string } | null) => { if (error) throw error; };

export const crewService = {
  async dashboard() {
    const { data, error } = await supabase.rpc('crew_admin_dashboard'); fail(error);
    return data as { active_members: number; pending_requests: number; expiring_30_days: number; confirmed_revenue: number };
  },
  async requests() {
    const { data, error } = await supabase.from('crew_membership_requests').select('*, customer:customer_profiles(id,customer_code,first_name,last_name,full_name,phone,email)').order('created_at', { ascending: false }); fail(error);
    return (data || []) as CrewMembershipRequest[];
  },
  async memberships() {
    const { data, error } = await supabase.from('crew_memberships').select('*, customer:customer_profiles(id,customer_code,first_name,last_name,full_name,phone,email)').order('started_at', { ascending: false }); fail(error);
    return (data || []) as CrewMembership[];
  },
  async accountLinkRequests() {
    const { data, error } = await supabase.from('customer_account_link_requests').select('*, customer:customer_profiles(id,customer_code,first_name,last_name,full_name,phone,email)').eq('status', 'pending').order('created_at', { ascending: false }); fail(error);
    return (data || []) as CustomerAccountLinkRequest[];
  },
  async plans() {
    const { data, error } = await supabase.from('crew_plans').select('*').order('sort_order'); fail(error);
    return (data || []) as CrewPlan[];
  },
  async benefits() {
    const [{ data: definitions, error }, { data: assignments, error: assignmentError }] = await Promise.all([
      supabase.from('crew_benefit_definitions').select('*').order('name'),
      supabase.from('crew_plan_benefits').select('*'),
    ]); fail(error); fail(assignmentError);
    return { definitions: (definitions || []) as CrewBenefitDefinition[], assignments: assignments || [] };
  },
  async settings() {
    const { data, error } = await supabase.from('crew_settings').select('*').eq('id', 1).single(); fail(error); return data;
  },
  async approve(requestId: string) { const { error } = await supabase.rpc('approve_crew_request', { p_request_id: requestId }); fail(error); },
  async reject(requestId: string, reason?: string) { const { error } = await supabase.rpc('reject_crew_request', { p_request_id: requestId, p_reason: reason || null }); fail(error); },
  async approveAccountLink(requestId: string) { const { error } = await supabase.rpc('approve_customer_account_link', { p_request_id: requestId }); fail(error); },
  async rejectAccountLink(requestId: string, reason?: string) { const { error } = await supabase.rpc('reject_customer_account_link', { p_request_id: requestId, p_reason: reason || null }); fail(error); },
  async receiptUrl(path: string) { const { data, error } = await supabase.storage.from('crew-receipts').createSignedUrl(path, 300); fail(error); return data?.signedUrl || null; },
  async savePlan(plan: CrewPlan) { const { error } = await supabase.from('crew_plans').update({ name: plan.name, price: plan.price, duration_months: plan.duration_months, is_active: plan.is_active }).eq('id', plan.id); fail(error); },
  async createBenefit(input: Omit<CrewBenefitDefinition, 'id'>, planIds: string[]) {
    const { data, error } = await supabase.from('crew_benefit_definitions').insert(input).select().single(); fail(error);
    if (planIds.length) { const { error: linkError } = await supabase.from('crew_plan_benefits').insert(planIds.map(plan_id => ({ plan_id, benefit_id: data.id }))); fail(linkError); }
  },
  async saveBenefit(input: CrewBenefitDefinition, planIds: string[]) {
    const { error } = await supabase.from('crew_benefit_definitions').update({ name: input.name, description: input.description || null, rule: input.rule, is_active: input.is_active, is_public: input.is_public }).eq('id', input.id); fail(error);
    const { error: deleteError } = await supabase.from('crew_plan_benefits').delete().eq('benefit_id', input.id); fail(deleteError);
    if (planIds.length) { const { error: linkError } = await supabase.from('crew_plan_benefits').insert(planIds.map(plan_id => ({ plan_id, benefit_id: input.id }))); fail(linkError); }
  },
  async saveSettings(paymentInstructions: string | null, paymentQrPath: string | null) { const { error } = await supabase.from('crew_settings').update({ payment_instructions: paymentInstructions, payment_qr_path: paymentQrPath }).eq('id', 1); fail(error); },
  async uploadQr(file: File) { const extension = file.name.split('.').pop()?.toLowerCase() || 'png'; const path = `payment/crew-qr-${Date.now()}.${extension}`; const { error } = await supabase.storage.from('crew-assets').upload(path, file, { upsert: false }); fail(error); return path; },
  async context(customerId: string) { const { data, error } = await supabase.rpc('get_customer_crew_context', { p_customer_id: customerId }); fail(error); return data as CrewContext; },
  async quote(customerId: string | null, items: Array<{ variantId: string; quantity: number; unitPrice: number }>, manualDiscount: number) {
    const { data, error } = await supabase.rpc('crew_calculate_sale_quote', { p_customer_id: customerId, p_items: items, p_manual_discount: manualDiscount }); fail(error); return data as CrewSaleQuote;
  },
};
