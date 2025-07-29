export interface Insurer {
  insurer_letter: string;
  insurer_name: string;
  naic_code: string;
}

export interface CertificateInformation {
  certificate_holder: string | null;
  certificate_number: string | null;
  revision_number: string | null;
  issue_date: string | null;
}

export interface PolicyInformation {
  policy_type: string | null;
  policy_number: string | null;
  effective_date: string | null;
  expiry_date: string | null;
}

export interface Coverage {
  limit_type: string | null;
  limit_value: number | null;
}

export interface Policy {
  policy_information: PolicyInformation;
  insurer_letter: string | null;
  coverages: Coverage[];
}

export interface PrimaryDetails {
  full_name: string | null;
  email_address: string | null;
  doing_business_as: string | null;
}

export interface ContactInformation {
  phone_number: string | null;
  fax_number: string | null;
  license_number: string | null;
}

export interface AddressDetails {
  address_line_1: string | null;
  address_line_2: string | null;
  address_line_3: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
}

export interface ProducerInformation {
  primary_details: PrimaryDetails;
  contact_information: ContactInformation;
  address_details: AddressDetails;
}

export interface PdfAnalysisResult {
  certificate_information: CertificateInformation;
  insurers: Insurer[];
  policies: Policy[];
  producer_information: ProducerInformation;
}

export interface PdfMetadata {
  originalSize: number;
  pageCount: number;
  compressedSize?: number;
  processingTime?: number;
}

export interface AnalysisResponse {
  success: boolean;
  data: PdfAnalysisResult;
  metadata: PdfMetadata;
  timestamp: Date;
}
