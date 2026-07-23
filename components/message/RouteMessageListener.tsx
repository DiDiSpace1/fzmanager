'use client';

import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {useEffect, useRef} from 'react';

import {useMessage} from './MessageProvider';

const successMessages: Record<string, string> = {
  document_deleted: '文档删除成功',
  document_uploaded: '文档上传成功',
  lease_created: '租约创建成功',
  lease_deleted: '租约删除成功',
  lease_terminated: '租约已结束',
  lease_updated: '租约修改成功',
  property_created: '房产创建成功',
  property_deleted: '房产删除成功',
  property_photo_deleted: '照片删除成功',
  property_updated: '房产修改成功',
  rent_status_updated: '租金状态更新成功',
  rent_status_updated_receipt_created: '租金已标记为已付款，收据已自动生成',
  rent_status_updated_receipt_exists: '租金已标记为已付款，本月收据已存在',
  rent_status_updated_receipt_failed: '租金已标记为已付款，但自动收据生成失败',
  tenant_created: '租客创建成功',
  tenant_deleted: '租客删除成功',
  tenant_status_updated: '租客状态更新成功',
  tenant_updated: '租客修改成功',
  transaction_created: '交易记录添加成功',
  transaction_deleted: '交易记录删除成功',
  transaction_updated: '交易记录修改成功'
};

const errorMessages: Record<string, string> = {
  charge_not_found: '未找到对应账单',
  charges_failed: '租金计划生成失败，请稍后重试',
  create_failed: '创建失败，请稍后重试',
  delete_failed: '删除失败，请稍后重试',
  document_delete_failed: '文档删除失败，请稍后重试',
  document_failed: '文档保存失败，请稍后重试',
  document_missing: '未找到对应文档',
  document_not_found: '未找到对应文档',
  document_type: '请选择正确的文档类型',
  expense_delete_failed: '支出记录删除失败，请稍后重试',
  expense_failed: '支出记录添加失败，请稍后重试',
  expense_missing: '请填写支出日期和金额',
  expense_update_failed: '支出记录修改失败，请稍后重试',
  file_missing: '请先选择要上传的文件',
  file_too_large: '文件过大，请选择较小的文件',
  lease_charges_delete_failed: '租金计划更新失败，请稍后重试',
  lease_charges_lookup_failed: '租金计划读取失败，请稍后重试',
  lease_charges_update_failed: '租金计划更新失败，请稍后重试',
  lease_delete_failed: '租约删除失败，请稍后重试',
  lease_delete_lookup_failed: '租约删除失败，请稍后重试',
  lease_failed: '租约创建失败，请稍后重试',
  lease_missing: '未找到对应租约',
  lease_payments_delete_failed: '租约付款记录删除失败，请稍后重试',
  lease_update_failed: '租约修改失败，请稍后重试',
  lease_update_missing: '请完整填写租约信息',
  missing_name: '请填写必填名称',
  missing_photo: '未找到对应照片',
  missing_property: '未找到对应房产',
  missing_tenant: '未找到对应租客',
  missing_termination: '请填写结束日期',
  partial_amount_missing: '请填写部分付款金额',
  payment_delete_failed: '付款记录删除失败，请稍后重试',
  payment_failed: '付款记录保存失败，请稍后重试',
  payment_not_found: '未找到对应付款记录',
  payment_status_failed: '付款状态更新失败，请稍后重试',
  payment_update_failed: '付款记录修改失败，请稍后重试',
  photo_delete_failed: '照片删除失败，请稍后重试',
  photo_failed: '照片保存失败，请稍后重试',
  photo_limit: '照片数量已达到当前套餐限制',
  photo_not_found: '未找到对应照片',
  photo_size: '照片文件过大',
  plan_limit: '当前套餐额度不足',
  rent_status_failed: '租金状态更新失败，请稍后重试',
  rent_status_missing: '请完整填写租金状态',
  revenue_failed: '收入记录添加失败，请稍后重试',
  revenue_missing: '请完整填写收入信息',
  revenue_overpaid: '付款金额不能超过待支付金额',
  storage_limit: '存储空间不足',
  tenant_status_failed: '租客状态更新失败，请稍后重试',
  transaction_missing: '未找到对应交易记录',
  update_failed: '修改失败，请稍后重试',
  upload_failed: '文件上传失败，请稍后重试'
};

function removeMessageParams(pathname: string, searchParams: URLSearchParams) {
  const nextParams = new URLSearchParams(searchParams);
  nextParams.delete('success');
  nextParams.delete('error');
  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function RouteMessageListener() {
  const message = useMessage();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastMessageKeyRef = useRef('');

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const key = `${pathname}:${success ?? ''}:${error ?? ''}`;

    if ((!success && !error) || lastMessageKeyRef.current === key) {
      return;
    }

    lastMessageKeyRef.current = key;

    if (success) {
      message.success(successMessages[success] ?? '操作成功');
    }

    if (error) {
      message.error(errorMessages[error] ?? '操作失败，请稍后重试');
    }

    router.replace(removeMessageParams(pathname, searchParams), {scroll: false});
  }, [message, pathname, router, searchParams]);

  return null;
}
