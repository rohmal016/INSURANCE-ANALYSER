export interface Insurer {
  insurer_letter: string;
  insurer_name: string;
  naic_code: string;
}

export interface PdfAnalysisResult {
  certificate_information: {
    certificate_holder: string;
    certificate_number: string;
    revision_number: string | null;
    issue_date: string;
  };
  insurers: Insurer[];
  policies: Policy[];
  producer_information: {
    primary_details: {
      full_name: string | null;
      email_address: string | null;
      doing_business_as: string | null;
    };
    contact_information: {
      phone_number: string;
      fax_number: string | null;
      license_number: string | null;
    };
    address_details: {
      address_line_1: string;
      address_line_2: string | null;
      address_line_3: string | null;
      city: string;
      state: string;
      zip_code: string;
      country: string;
    };
  };
}

export interface Policy {
  policy_information: {
    policy_type: string;
    policy_number: string;
    effective_date: string;
    expiry_date: string;
  };
  insurer_letter: string;
  coverages: Coverage[];
}

export interface Coverage {
  limit_type: string;
  limit_value: number;
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