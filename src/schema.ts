import { imp, code, Code, joinCode, def } from 'ts-poet';
import { google } from '../build/pbjs';
import { visit, visitServices } from './visit';
import { Context } from './context';
import SourceInfo from './sourceInfo';
import FileDescriptorProto = google.protobuf.FileDescriptorProto;

export function generateSchema(ctx: Context, fileDesc: FileDescriptorProto, sourceInfo: SourceInfo): Code[] {
  const { options } = ctx;
  const chunks: Code[] = [];

  chunks.push(code`
    export interface ProtoMetadata {
      fileDescriptor: ${imp('IFileDescriptorProto@protobufjs/ext/descriptor')};
      references: { [key: string]: any };
      dependencies?: ProtoMetadata[];
    }
  `);

  const references: Code[] = [];
  function addReference(localName: string, symbol: string): void {
    references.push(code`'.${fileDesc.package}.${localName.replace(/_/g, '.')}': ${symbol}`);
  }

  visit(
    fileDesc,
    sourceInfo,
    (fullName) => {
      if (options.outputEncodeMethods) {
        addReference(fullName, fullName);
      }
    },
    options,
    (fullName) => {
      addReference(fullName, fullName);
    }
  );

  visitServices(fileDesc, sourceInfo, (serviceDesc) => {
    if (options.outputClientImpl) {
      addReference(serviceDesc.name, `${serviceDesc.name}ClientImpl`);
    }
  });

  const dependencies = fileDesc.dependency.map((dep) => {
    return code`${imp(`protoMetadata@./${dep.replace('.proto', '')}`)}`;
  });

  // Use toObject so that we get enums as numbers (instead of the default toJSON behavior)
  const descriptor = FileDescriptorProto.toObject(fileDesc);

  // Only keep locations that include comments
  descriptor.sourceCodeInfo = {
    location: descriptor.sourceCodeInfo.location.filter((loc) => loc['leadingComments'] || loc['trailingComments']),
  };

  // TODO Remove the 'as any` from fileDescriptor once protobufjs includes `proto3Optional`
  chunks.push(code`
    export const ${def('protoMetadata')}: ProtoMetadata = {
      fileDescriptor: ${descriptor} as any,
      references: { ${joinCode(references, { on: ',' })} },
      dependencies: [${joinCode(dependencies, { on: ',' })}],
    }
  `);

  return chunks;
}