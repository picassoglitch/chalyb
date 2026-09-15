# Compute costs — the engines without a GPU box

Short version of the evaluation kept with the ChalyClip code
(`docs/compute_cost_evaluation.md` in `picassoglitch/ChalyClip`). That file
has the option-by-option numbers; this one is what the Terraform here
implements and why.

## What the dead machine did

ChalyClip's pipeline ran on the self-hosted PC: CPU work (ingest, scene
detection, ffmpeg) plus three GPU jobs — Whisper transcription, and Ollama
serving a text model and a vision model for every LLM purpose. Modal had
done the same two GPU jobs before that. The `CHALYBCLIP_MODAL_*` env vars
that survive are the kickoff/poll protocol between API and worker; nothing
in them calls Modal, and no Modal account is needed.

## What replaces it

| Workload                                 | Runs on                                                  | Cost per hour-long VOD | Idle cost |
| ---------------------------------------- | -------------------------------------------------------- | ---------------------- | --------- |
| Pipeline CPU                             | `chalybclip-worker`, Cloud Run, 4 vCPU / 8 GiB           | ~$0.13                 | $0        |
| Transcription                            | AssemblyAI (`CHALYBCLIP_TRANSCRIBE_PROVIDER=assemblyai`) | ~$0.17                 | $0        |
| Text LLM (hooks, viral detection)        | Anthropic Haiku 4.5 through the engine's router          | ~$0.03                 | $0        |
| Vision LLM (frame rescoring, smart crop) | Anthropic Haiku 4.5, same key                            | ~$0.07                 | $0        |

Roughly **$0.40 per VOD-hour, $0 at rest**: ~$20/month at 50 VOD-hours,
~$80 at 200. A GPU kept warm on Cloud Run (L4) is ~$600/month before it
processes anything and only wins past ~500 VOD-hours/month; a GPU box of
your own is $0 in APIs and the single point of failure that just died.

## What Terraform does about it

- `variables.tf`: the ChalyClip worker is 4 vCPU / 8 GiB (same vCPU-seconds
  per run, half the wall time); `CHALYBCLIP_TRANSCRIBE_PROVIDER=assemblyai`.
- `secrets.tf`: two new shared placeholders, `assemblyai-api-key` and
  `anthropic-api-key`, injected into ChalyClip as
  `CHALYBCLIP_ASSEMBLYAI_API_KEY` and `ANTHROPIC_API_KEY`. Step 4 of the
  runbook fills them.
- `modules/engine`: `object_storage_env_prefix` creates an HMAC key on the
  engine's service account and injects `CHALYBCLIP_OBJECT_STORAGE_*` so the
  engine's boto3 client reaches the GCS media bucket through the S3
  endpoint. Without a bucket the pipeline refuses to run — clip artifacts
  must outlive the worker's disk.

## If volume grows

Cheaper transcription exists (Groq's Whisper at ~$0.04/hour) but the engine's
OpenAI-compatible transcribe provider is still a stub; that is the first
thing to build past a few hundred VOD-hours a month. Past that, revisit a
GPU: Cloud Run L4 with scale-to-zero, or a flat-rate box.
