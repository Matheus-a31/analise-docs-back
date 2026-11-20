output "s3_bucket_name" {
  description = "Nome do bucket S3 criado (AWS_S3_BUCKET)"
  value       = aws_s3_bucket.documents.id
}

output "s3_bucket_region" {
  description = "Região do bucket S3 (AWS_REGION)"
  value       = aws_s3_bucket.documents.region
}

output "aws_access_key_id" {
  description = "Access Key ID do usuário IAM da aplicação (AWS_ACCESS_KEY_ID)"
  value       = aws_iam_access_key.app_s3_key.id
}

output "aws_secret_access_key" {
  description = "Secret Access Key do usuário IAM (AWS_SECRET_ACCESS_KEY)"
  value       = aws_iam_access_key.app_s3_key.secret
  sensitive   = true
}
