# The single most valuable resource in this file.
#
# Video egress is the one line item in this architecture that can run away
# (see the RTMP section of docs/infra/gcp-migration.md). A budget alert does
# not cap spend — nothing in GCP does — but it means a runaway bill is noticed
# in hours rather than at the end of the month.

resource "google_monitoring_notification_channel" "budget" {
  for_each = toset(var.budget_alert_emails)

  display_name = "Budget alert: ${each.value}"
  type         = "email"

  labels = {
    email_address = each.value
  }

  depends_on = [google_project_service.enabled]
}

resource "google_billing_budget" "monthly" {
  count = var.billing_account == "" ? 0 : 1

  billing_account = var.billing_account
  display_name    = "${var.project_id} monthly"

  budget_filter {
    projects = ["projects/${data.google_project.this.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.budget_amount_usd)
    }
  }

  # Warn early, not at the point the money is already spent.
  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 0.9
  }
  threshold_rules {
    threshold_percent = 1.0
  }

  dynamic "all_updates_rule" {
    for_each = length(var.budget_alert_emails) > 0 ? [1] : []
    content {
      monitoring_notification_channels = [
        for c in google_monitoring_notification_channel.budget : c.id
      ]
      disable_default_iam_recipients = false
    }
  }

  depends_on = [google_project_service.enabled]
}

data "google_project" "this" {
  project_id = var.project_id
}
