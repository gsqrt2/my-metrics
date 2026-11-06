import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'

import { FormField } from '@/components/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  displayNameSchema,
  MAX_DISPLAY_NAME_LENGTH,
  type DisplayNameValues,
} from '@/features/profile/schemas'
import { supabase } from '@/lib/supabase'

export function DisplayNameCard({
  userId,
  displayName,
}: {
  userId: string
  displayName: string
}) {
  const queryClient = useQueryClient()
  const form = useForm<DisplayNameValues>({
    resolver: zodResolver(displayNameSchema),
    values: { displayName },
  })
  const { errors, isDirty } = form.formState

  const save = useMutation({
    mutationFn: async ({ displayName }: DisplayNameValues) => {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', userId)
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Display name</h2>
        </CardTitle>
        <CardDescription>
          How other members see you in shared groups.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
          noValidate
          className="flex flex-col gap-4"
        >
          {save.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                Saving failed. Please try again.
              </AlertDescription>
            </Alert>
          )}
          <FormField
            id="display-name"
            label="Display name"
            autoComplete="nickname"
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            error={errors.displayName?.message}
            {...form.register('displayName')}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!isDirty || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
            {save.isSuccess && !isDirty && (
              <p role="status" className="text-sm text-muted-foreground">
                Saved.
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
