import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { supabase, PRODUCT_ID } from '@/lib/supabase'

async function writeAudit(action: string, entity: string, entityId: string, userId: string) {
  try {
    await supabase.from('audit_log').insert({
      product_id: PRODUCT_ID,
      customer_id: userId,
      action,
      entity,
      entity_id: entityId,
    })
  } catch (e) {
    void e
  }
}

export interface Job {
  id: string
  job_type: string
  status: string
  input_file_path: string | null
  input_file_paths: string[] | null
  output_file_path: string | null
  result_summary: Record<string, unknown> | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

async function fetchJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(
      'id, job_type, status, input_file_path, input_file_paths, output_file_path, result_summary, error_message, created_at, completed_at'
    )
    .eq('product_id', PRODUCT_ID)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export function useJobs() {
  return useQuery({
    queryKey: ['jobs', PRODUCT_ID],
    queryFn: fetchJobs,
    refetchInterval: 5000,
  })
}

const TRIAL_LIMIT = 3

export function useTrialUsage() {
  const user = useAuthStore((state) => state.auth.user)
  const isPaid = !!(user as { app_metadata?: { product_id?: string } } | null)?.app_metadata?.product_id
  const { data: jobs } = useJobs()
  const used = jobs?.filter(j => ['pending','processing','completed'].includes(j.status)).length ?? 0
  return { used, limit: TRIAL_LIMIT, isPaid }
}

async function getRecordCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', PRODUCT_ID)
    .eq('customer_id', userId)
    .in('status', ['pending', 'processing', 'completed'])
  if (error) throw error
  return count ?? 0
}

export function useUploadJob() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trialLimitReached, setTrialLimitReached] = useState(false)
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)

  async function uploadOne(path: string, file: File) {
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(path, file)
    if (uploadError) throw uploadError
  }

  async function uploadFile(file: File, jobType = 'process_upload') {
    if (!user) { setError('Not logged in'); return null }
    if (user.product_id !== import.meta.env.VITE_PRODUCT_ID) {
      const count = await getRecordCount(user.id)
      if (count >= TRIAL_LIMIT) { setTrialLimitReached(true); return null }
    }
    setUploading(true)
    setError(null)
    try {
      const path = `${user.id}/${Date.now()}_${file.name}`
      await uploadOne(path, file)
      const { data: jobData, error: insertError } = await supabase
        .from('jobs')
        .insert({ product_id: PRODUCT_ID, customer_id: user.id, job_type: jobType, status: 'pending', input_file_path: path })
        .select()
        .single()
      if (insertError) throw insertError
      queryClient.invalidateQueries({ queryKey: ['jobs', PRODUCT_ID] })
      if (user?.id && jobData?.id) void writeAudit('job.created', 'job', String(jobData.id), user.id)
      return jobData
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      return null
    } finally {
      setUploading(false)
    }
  }

  async function uploadFiles(files: File[], jobType = 'process_upload') {
    if (!user) { setError('Not logged in'); return null }
    if (files.length === 0) { setError('No files selected'); return null }
    if (user.product_id !== import.meta.env.VITE_PRODUCT_ID) {
      const count = await getRecordCount(user.id)
      if (count >= TRIAL_LIMIT) { setTrialLimitReached(true); return null }
    }
    setUploading(true)
    setError(null)
    try {
      const batchId = Date.now()
      const paths = await Promise.all(
        files.map(async (file) => {
          const path = `${user.id}/${batchId}/${file.name}`
          await uploadOne(path, file)
          return path
        })
      )
      const { data: jobData, error: insertError } = await supabase
        .from('jobs')
        .insert({ product_id: PRODUCT_ID, customer_id: user.id, job_type: jobType, status: 'pending', input_file_paths: paths })
        .select()
        .single()
      if (insertError) throw insertError
      queryClient.invalidateQueries({ queryKey: ['jobs', PRODUCT_ID] })
      return jobData
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      return null
    } finally {
      setUploading(false)
    }
  }

  return { uploadFile, uploadFiles, uploading, error, trialLimitReached, setTrialLimitReached }
}

export async function downloadJobResult(outputFilePath: string, filename: string) {
  const { data, error } = await supabase.storage.from('results').download(outputFilePath)
  if (error) throw error
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
