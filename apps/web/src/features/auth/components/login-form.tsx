import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/ui/field";
import { Input } from "@workspace/ui/components/ui/input";
import { Button } from "@workspace/ui/components/ui/button";
import { Spinner } from "@workspace/ui/components/ui/spinner";

import { useNavigate, Link } from "react-router-dom";
import { appPaths } from "@/config/app-paths";

import { apiRequest } from "@/lib/api-client";
import { setStoredTokens } from "@/lib/auth";
import { loginSchema, type LoginFormData, passkeyLoginSchema, type PasskeyLoginFormData } from "../schemas";
import { loginWithPasskey } from "../lib/passkeys";
import { useMutation } from "@tanstack/react-query";
import type { LoginResponse } from "@/lib/api-types";
import { Fingerprint, Key } from "lucide-react";

const LoginForm = () => {
  const navigate = useNavigate();
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "test@example.com",
      password: "TestPassword123",
    },
  });

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (payload: LoginFormData) =>
      apiRequest<LoginResponse>({
        method: "POST",
        url: "/api/auth/login",
        data: payload,
        toastSuccess: true,
        successMessage: "Logged in",
      }),
  });

  const { mutateAsync: passkeyMutateAsync, isPending: isPasskeyPending } = useMutation({
    mutationFn: (payload: PasskeyLoginFormData) => loginWithPasskey(payload.email),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      const result = await mutateAsync(
        data,
      );

      if (result?.accessToken && result?.refreshToken) {
        setStoredTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
      }

      navigate(appPaths.auth.dashboard.getHref());
    } catch {
      return;
    }
  };

  const onPasskeyLogin = async () => {
    const parsed = passkeyLoginSchema.safeParse({
      email: form.getValues("email"),
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      form.setError("email", { message: issue?.message ?? "Email is required" });
      return;
    }

    try {
      const result = await passkeyMutateAsync({ email: parsed.data.email });

      if (result?.accessToken && result?.refreshToken) {
        setStoredTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
      }

      navigate(appPaths.auth.dashboard.getHref());
    } catch {
      return;
    }
  };

  return (
    <Card className="w-full sm:max-w-md">
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>Login to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="login-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    {...field}
                    placeholder="Enter your email"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>Password</FieldLabel>
                  <Input
                    {...field}
                    placeholder="Enter your password"
                    autoComplete="off"
                    type="password"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter>
        <Field orientation="responsive">
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Button type="submit" form="login-form" disabled={isPending || isPasskeyPending}>
              {(isPending || isPasskeyPending) && <Spinner />}
              <Key className="size-4" />
              Login
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onPasskeyLogin}
              disabled={isPending || isPasskeyPending}
            >
              {isPasskeyPending && !isPending && <Spinner />}
              <Fingerprint className="size-4" />
              Use passkey
            </Button>
          </div>
          <FieldDescription className="text-center">
            Don&apos;t have an account?{" "}
            <Link to={appPaths.auth.register.getHref()}>Sign up</Link>
          </FieldDescription>
        </Field>
      </CardFooter>
    </Card>
  );
};

export { LoginForm };
