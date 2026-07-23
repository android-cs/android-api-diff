interface AndroidVersionItem {
  version: string;
  alias: string;
  apiVersion: number;
  tags: string[];
  futureTags: string[];
}

interface VersionUrlBuilder {
  filePath: string;
  templateUrl: [string, string];
}

interface DiffResultItem {
  tag: string;
  file: import('@android-cs/api-parser').ApiFile;
  structs: import('@android-cs/api-parser').ClassStruct[];
  target: import('@android-cs/api-parser').ClassStruct | undefined;
  members: import('@android-cs/api-parser').ClassMember[] | undefined;
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
  filePath: string;
  targetUrl: string;
  targetPaths: string[];
  targetKind: SearchTargetKind;
}

interface AndroidVersionInfo {
  version: string;
  alias: string;
  apiVersion: number;
}
