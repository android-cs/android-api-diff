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
  structs: import('@ikun/syntax').ClassStruct[];
  target: import('@ikun/syntax').ClassStruct | undefined;
  members: import('@ikun/syntax').ClassMember[] | undefined;
  typeDesc: string;
  typeColor: string;
  notFound: boolean;
}

interface DiffTypeItem {
  typeDesc: string;
  typeColor: string;
  tagRanges: string[][];
}
interface SearchFromData {
  targetUrl: string;
  targetName: string;
  targetProp: string;
}
