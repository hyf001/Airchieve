import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

export function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: quota } = useQuery({
    queryKey: ['quota'],
    queryFn: () => authApi.getQuota(),
  });

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => authApi.getConfig(),
  });

  const { data: models } = useQuery({
    queryKey: ['available-models'],
    queryFn: () => authApi.getAvailableModels(),
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => authApi.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success('设置已保存');
    },
    onError: () => {
      toast.error('保存设置失败');
    },
  });

  const quotaData = quota?.data || { daily_limit: 100, used_today: 0, remaining: 100 };
  const configData = config?.data || {};
  const availableModels = models?.data || [];

  const usagePercent = (quotaData.used_today / quotaData.daily_limit) * 100;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-slate-500">管理您的账户设置和偏好</p>
      </div>

      {/* Quota Card */}
      <Card>
        <CardHeader>
          <CardTitle>使用配额</CardTitle>
          <CardDescription>您的每日使用额度</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">
                {quotaData.used_today} / {quotaData.daily_limit}
              </p>
              <p className="text-sm text-slate-500">今日已使用 / 每日限额</p>
            </div>
            <Badge variant={quotaData.remaining > 10 ? 'default' : 'destructive'}>
              剩余 {quotaData.remaining}
            </Badge>
          </div>
          <Progress value={usagePercent} className="h-3" />
          <p className="text-sm text-slate-500">
            配额每日 00:00 重置。点赞可获得额外配额奖励。
          </p>
        </CardContent>
      </Card>

      {/* Model Settings */}
      <Card>
        <CardHeader>
          <CardTitle>模型设置</CardTitle>
          <CardDescription>选择默认使用的 AI 模型</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>默认模型</Label>
            <Select
              value={configData.default_model || ''}
              onValueChange={(value) =>
                updateConfigMutation.mutate({ default_model: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择默认模型" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model: string) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle>通知设置</CardTitle>
          <CardDescription>管理通知偏好</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>邮件通知</Label>
              <p className="text-sm text-slate-500">接收标注相关的邮件通知</p>
            </div>
            <Switch
              checked={configData.email_notifications !== false}
              onCheckedChange={(checked) =>
                updateConfigMutation.mutate({ email_notifications: checked })
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>评估完成通知</Label>
              <p className="text-sm text-slate-500">评估任务完成后收到通知</p>
            </div>
            <Switch
              checked={configData.evaluation_notifications !== false}
              onCheckedChange={(checked) =>
                updateConfigMutation.mutate({ evaluation_notifications: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Appearance Settings */}
      <Card>
        <CardHeader>
          <CardTitle>外观设置</CardTitle>
          <CardDescription>自定义界面显示</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>语言</Label>
            <Select
              value={configData.language || 'zh-CN'}
              onValueChange={(value) =>
                updateConfigMutation.mutate({ language: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh-CN">简体中文</SelectItem>
                <SelectItem value="en-US">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>紧凑模式</Label>
              <p className="text-sm text-slate-500">减少界面间距以显示更多内容</p>
            </div>
            <Switch
              checked={configData.compact_mode === true}
              onCheckedChange={(checked) =>
                updateConfigMutation.mutate({ compact_mode: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
