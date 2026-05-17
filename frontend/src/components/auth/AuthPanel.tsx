import React from "react";
import { LogIn, MessageSquareText, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const AuthPanel: React.FC = () => (
  <Card className="glass-card">
    <CardHeader className="pb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg">登录入口</CardTitle>
          <CardDescription>仅保留界面占位，不包含登录业务逻辑</CardDescription>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Smartphone className="h-5 w-5" />
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="auth-phone">
          手机号
        </label>
        <Input id="auth-phone" inputMode="tel" placeholder="请输入手机号" disabled />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="auth-code">
          短信验证码
        </label>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input id="auth-code" inputMode="numeric" placeholder="6 位验证码" disabled />
          <Button type="button" variant="secondary" disabled>
            <MessageSquareText className="mr-2 h-4 w-4" />
            获取
          </Button>
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <input className="mt-1 h-4 w-4 rounded border-input accent-primary" type="checkbox" disabled />
        <span>我已阅读并同意用户协议和隐私政策，并确认由家长或老师进行账号操作。</span>
      </label>

      <Button className="w-full" disabled>
        <LogIn className="mr-2 h-4 w-4" />
        登录 / 注册
      </Button>
    </CardContent>
  </Card>
);

export default AuthPanel;
