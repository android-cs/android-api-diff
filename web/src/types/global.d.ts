interface AndroidVersionItem {
  version: string;
  alias: string;
  tags: string[];
  futureTags: string[];
}

interface VersionUrlBuilder {
  filePath: string;
  templateUrl: [string, string];
}

interface DiffResultItem {
  tag: string;
  structs: import('syntax').ClassStruct[];
  target: import('syntax').ClassStruct | undefined;
  members: import('syntax').ClassMember[] | undefined;
  typeDesc: string;
  typeColor: string;
  notFound: boolean;
}

interface DiffTypeItem {
  typeDesc: string;
  typeColor: string;
  tagRanges: string[][];
}
type SearchTargetKind = 'file' | 'class' | 'member';
interface SearchFromData {
  targetUrl: string;
  targetPaths: string[];
  targetKind: SearchTargetKind;
}
