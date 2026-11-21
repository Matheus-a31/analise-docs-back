variable "aws_region" {
  description = "Região da AWS para criação do bucket S3"
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "Nome único global do bucket S3 para armazenar os documentos originais"
  type        = string
  default     = "jus-digital-documents-desafio"
}

variable "access_logs_bucket_name" {
  description = "Nome do bucket S3 central de destino para os Server Access Logs"
  type        = string
  default     = "jus-digital-s3-access-logs"
}

variable "environment" {
  description = "Ambiente de execução (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "force_destroy" {
  description = "Permite destruir o bucket ao final da avaliação (terraform destroy)"
  type        = bool
  default     = true
}

variable "allowed_cors_origins" {
  description = "Origens permitidas no CORS do S3"
  type        = list(string)
  default     = ["http://localhost:5173", "http://localhost:3000"]
}
