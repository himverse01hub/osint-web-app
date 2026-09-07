export const EntityType = {
  person: 'person',
  phone: 'phone',
  email: 'email',
  username: 'username',
  organization: 'organization',
  location: 'location',
  crypto_wallet: 'crypto_wallet',
  social_account: 'social_account',
  vehicle: 'vehicle',
  document: 'document',
} as const;
export type EntityType = (typeof EntityType)[keyof typeof EntityType];

export const SourceType = {
  social_media: 'social_media',
  news: 'news',
  public_records: 'public_records',
  forum: 'forum',
  database: 'database',
  dark_web: 'dark_web',
  leaked_data: 'leaked_data',
  government: 'government',
  corporate: 'corporate',
  other: 'other',
  blockchain: 'blockchain',
  intelligence: 'intelligence',
} as const;
export type SourceType = (typeof SourceType)[keyof typeof SourceType];

export interface Entity {
  id: string;
  type: EntityType;
  value: string;
  label: string;
  confidence: number;
  source: SourceType;
  sourceUrl?: string;
  sourceName: string;
  discoveredAt: string;
  verified: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface Person extends Entity {
  type: 'person';
  aliases: string[];
  phones: string[];
  emails: string[];
  usernames: string[];
  socialAccounts: SocialAccount[];
  locations: Location[];
  organizations: Organization[];
  cryptoWallets: CryptoWallet[];
  vehicles: Vehicle[];
  documents: Document[];
  riskScore: number;
  status: 'active' | 'monitoring' | 'archived' | 'priority';
  caseNumbers: string[];
}

export interface Phone extends Entity {
  type: 'phone';
  carrier?: string;
  location?: string;
  registeredName?: string;
  linkedAccounts: string[];
}

export interface Email extends Entity {
  type: 'email';
  domain: string;
  provider?: string;
  linkedAccounts: string[];
  breaches: BreachInfo[];
}

export interface Username extends Entity {
  type: 'username';
  platform: string;
  profileUrl?: string;
  bio?: string;
  followers?: number;
  following?: number;
}

export interface Organization extends Entity {
  type: 'organization';
  industry?: string;
  registrationNumber?: string;
  address?: string;
  keyPeople: string[];
}

export interface Location extends Entity {
  type: 'location';
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  visitCount: number;
  lastVisit?: string;
}

export interface CryptoWallet extends Entity {
  type: 'crypto_wallet';
  currency: string;
  balance?: string;
  transactions: number;
  firstSeen: string;
  lastActivity: string;
  exchanges: string[];
}

export interface SocialAccount extends Entity {
  type: 'social_account';
  platform: string;
  handle: string;
  displayName?: string;
  bio?: string;
  followers?: number;
  following?: number;
  posts?: number;
  verified: boolean;
  profileUrl: string;
  createdAt?: string;
}

export interface Vehicle extends Entity {
  type: 'vehicle';
  registrationNumber: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  registeredOwner?: string;
}

export interface Document extends Entity {
  type: 'document';
  documentType: string;
  documentNumber: string;
  issuingAuthority?: string;
  expiryDate?: string;
}

export interface BreachInfo {
  name: string;
  date: string;
  dataTypes: string[];
  source: string;
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  strength: number;
  confidence: number;
  sources: SourceType[];
  description: string;
  discoveredAt: string;
  verified: boolean;
}

export type RelationshipType =
  | 'phone_shared'
  | 'email_shared'
  | 'username_shared'
  | 'location_shared'
  | 'organization_shared'
  | 'crypto_shared'
  | 'social_connection'
  | 'vehicle_shared'
  | 'document_shared'
  | 'known_associate'
  | 'family'
  | 'business_partner'
  | 'financial_transaction'
  | 'communication'
  | 'co_occurrence';

export interface SearchResult {
  entities: Entity[];
  relationships: Relationship[];
  totalCount: number;
  query: SearchQuery;
  executedAt: string;
  executionTimeMs: number;
}

export interface SearchQuery {
  type: 'name' | 'phone' | 'email' | 'username' | 'organization' | 'crypto_wallet';
  value: string;
  filters?: SearchFilters;
}

export interface SearchFilters {
  sources?: SourceType[];
  dateRange?: { start: string; end: string };
  confidenceMin?: number;
  entityTypes?: EntityType[];
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  entityId?: string;
  entityType?: EntityType;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  metadata: Record<string, unknown>;
}

export type AlertType =
  | 'new_connection'
  | 'new_account'
  | 'location_change'
  | 'darkweb_mention'
  | 'breach_detected'
  | 'high_risk_activity'
  | 'watchlist_match'
  | 'report_generated';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  status: 'success' | 'failure';
}

export interface InvestigationCase {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  status: 'open' | 'active' | 'closed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  entities: string[];
  tags: string[];
}

export interface Report {
  id: string;
  caseId: string;
  title: string;
  type: 'intelligence' | 'investigation' | 'summary' | 'threat_assessment';
  status: 'draft' | 'final' | 'archived';
  generatedBy: string;
  generatedAt: string;
  content: ReportContent;
  exports: ReportExport[];
}

export interface ReportContent {
  subjectOverview: string;
  keyFindings: string[];
  associatedIdentities: Entity[];
  onlinePresence: Entity[];
  relationships: Relationship[];
  investigativeLeads: InvestigativeLead[];
  sources: Source[];
}

export interface InvestigativeLead {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  entityIds: string[];
  recommendedActions: string[];
}

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  url?: string;
  accessedAt: string;
  reliability: 'high' | 'medium' | 'low';
}

export interface ReportExport {
  id: string;
  format: 'pdf' | 'html' | 'json';
  url: string;
  generatedAt: string;
}

export interface DarkWebMention {
  id: string;
  entityId: string;
  entityType: EntityType;
  marketPlace: string;
  listingTitle: string;
  description: string;
  price?: string;
  currency?: string;
  seller?: string;
  datePosted: string;
  dataTypes: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  verified: boolean;
  sourceUrl: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    entities?: Entity[];
    relationships?: Relationship[];
    searchResults?: SearchResult;
    chartData?: ChartData;
  };
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar';
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}