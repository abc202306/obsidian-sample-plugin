/**
 * @version v1.0.1.20260204
 */

import { App, CachedMetadata, FrontMatterCache, MetadataCache, TFile } from "obsidian";

import ArrayUtil from "./util/arrayutil.js"
import AstNode from "./model/astnode.js";
import Link from "./model/link.js";

declare const app: App;


class Page {
    file: TFile;
    fileCache: CachedMetadata;
    note: FrontMatterCache;
    formula: Record<string, any>;
    constructor({ file, fileCache, note, formula }: { file: TFile, fileCache: CachedMetadata, note: FrontMatterCache, formula: Record<string, any> }) {
        this.file = file;
        this.fileCache = fileCache;
        this.note = note;
        this.formula = formula;
    }
    public static getPages(folderPath: string): Page[] {
        return app.vault.getMarkdownFiles()
            .filter((file: TFile) => file.path.startsWith(folderPath))
            .map((file: TFile) => {
                const fileCache = app.metadataCache.getFileCache(file)!!;
                const note = fileCache?.frontmatter || {};
                const additionalInfo = Object.entries(note)
                    .filter(([key, _]) => !["title", "url", "ctime", "description", "cover", "icon", "comment", "keywords", "categories", "tags"].includes(key))
                    .reduce((obj, [key, value]) => {
                        if (value === null || value === undefined) return obj;
                        obj[key] = value;
                        return obj;
                    }, {} as any);
                if (note.icon) {
                    additionalInfo.cover = note.cover;
                }
                if (note.cover) {
                    additionalInfo.cover = note.icon;
                }
                const formula = {
                    tags: StringTemplate.tags({ note, fileCache }),
                    categories: note.categories,
                    additionalInfo,
                    image: note.cover || note.icon || note.image
                }
                return new Page({
                    file,
                    fileCache,
                    formula,
                    note
                })
            }).sort((a: Page, b: Page) => b.note.ctime?.localeCompare(a.note.ctime));
    }
}

class StringTemplate {
    public static getFolderHeadingText(folderPath: string): string {
        return (folderPath.split("/").filter(part => part.length !== 0).at(-1) || "");
    }

    public static replaceAllImageEmbed(comment: string): string {
        const IMAGE_EMBED_REGEXP = /\!(?<wikilink>\[\[(?<path>.*?\.(png|jpg|webp|svg))\|(?<width>\d+)\]\])/;
        let match;
        while (true) {
            match = IMAGE_EMBED_REGEXP.exec(comment);

            if (!match) {
                break;
            }
            const wikilinkObj = Link.parseWikiLink(match.groups?.wikilink);
            const imageNode = wikilinkObj?.toImageNode(parseInt(match.groups?.width || "200"));
            comment = comment.replace(IMAGE_EMBED_REGEXP, imageNode?.toString() || "");
        }
        return comment;
    }

    public static tagsFromFileCache({ fileCache }: { fileCache: CachedMetadata }): string[] {
        return ArrayUtil.safeArray(fileCache?.tags?.map((tagInfo: { tag: string }) => tagInfo.tag.slice(1))?.unique())
    }

    public static tags({ note, fileCache }: { note: FrontMatterCache, fileCache: CachedMetadata }): string[] {
        return ArrayUtil.safeArray(note.tags).concat(StringTemplate.tagsFromFileCache({ fileCache }));
    }
}

class AstNodeTemplate {
    public static moc(FOLDER_ARRAY: string[]): AstNode {
        const infoArray: { li: AstNode, mocData: AstNode[] }[] = FOLDER_ARRAY.map(folder => {
            const folderHeadingText = StringTemplate.getFolderHeadingText(folder);
            const mocData = AstNodeTemplate.folderMOC(folder);
            const li = AstNode.li().setChildren([
                AstNode.p().setChildren([AstNode.textMarkA({ textMarkAHref: `#${folderHeadingText}`, textMarkTextContent: folderHeadingText })]),
                mocData[1]!!
            ])
            return { li, mocData };
        })
        const docNode = AstNode.doc().setChildren([
            AstNode.h({ headingLevel: 2 }).setChildren([AstNode.mdText({ data: "table-of-contents" })]),
            AstNode.blockquote().setChildren([AstNode.ul().setChildren([
                ...infoArray.map(info => info.li),
                AstNode.li().setChildren([
                    AstNode.p().setChildren([AstNode.textMarkA({ textMarkAHref: "#categories", textMarkTextContent: "categories" })])
                ]),
                AstNode.li().setChildren([
                    AstNode.p().setChildren([AstNode.textMarkA({ textMarkAHref: "#tags", textMarkTextContent: "tags" })])
                ])
            ])]),
            ...infoArray.flatMap(info => info.mocData),
            AstNode.h({ headingLevel: 2 }).setChildren([AstNode.mdText({ data: "categories" })]),
            ...AstNodeTemplate.indexMOC(FOLDER_ARRAY, "categories", "category", false),
            AstNode.h({ headingLevel: 2 }).setChildren([AstNode.mdText({ data: "tags" })]),
            ...AstNodeTemplate.indexMOC(FOLDER_ARRAY, "tags", "tag", false)
        ]);
        return docNode;
    }

    public static indexMOC(FOLDER_ARRAY: string[], keyName: string, keyNameSingular: string, disableDispSingleResultIndex: boolean): AstNode[] {
        const pages = FOLDER_ARRAY.flatMap(folderPath => Page.getPages(folderPath));
        const keyPageMap: Map<string, Page[]> = new Map();
        pages.forEach((page) => {
            ArrayUtil.safeArray(page.formula[keyName]).forEach(key => {
                if (keyPageMap.get(key)) {
                    keyPageMap.get(key)?.push(page);
                } else {
                    keyPageMap.set(key, [page]);
                }
            })
        });
        const entries = [...keyPageMap.entries()].filter(e => disableDispSingleResultIndex ? (e[1].length >= 2) : true).sort((a, b) => a[0].localeCompare(b[0]));
        function getKeyDisplay(key: any) {
            return Link.parseWikiLink(key)?.path || key;
        }
        const ul = AstNode.ul().setChildren(entries.map(([key, pageItems]) => {
            return AstNode.li().setChildren([
                AstNode.p().setChildren([
                    AstNode.textMarkA({ textMarkAHref: `#idx-${keyNameSingular}-${getKeyDisplay(key)}`, textMarkTextContent: `${getKeyDisplay(key)}` }),
                    AstNode.text({ data: ` | ${pageItems.length}` })
                ]),
            ])
        }));

        const keySectionNodes = entries.flatMap(([key, pageItems]) => {
            return [
                AstNode.h({ headingLevel: 3 }).setChildren([AstNode.mdText({ data: `idx-${keyNameSingular}-${getKeyDisplay(key)}` })]),
                AstNode.ul().setChildren(pageItems.map(page => {
                    return AstNode.li().setChildren([AstNodeTemplate.titleParagraph(page)])
                }))
            ]
        })

        return [ul, ...keySectionNodes];
    }
    private static folderMOC(folderPath: string): AstNode[] {
        const folderHeadingText = StringTemplate.getFolderHeadingText(folderPath);
        const pages = Page.getPages(folderPath);

        const nodeArrArr: AstNode[][] = pages
            .sort((a: Page, b: Page) => b.note.ctime?.localeCompare(a.note.ctime))
            .map(page => AstNodeTemplate.itemSection(page, 3));

        return [
            AstNode.h({ headingLevel: 2 }).setChildren([
                AstNode.mdText({ data: folderHeadingText })
            ]),
            AstNode.ul().setChildren(nodeArrArr.map(nodeArr => AstNode.li().setChildren([nodeArr[1]!!]))),
            ...nodeArrArr.flatMap(nodeArr => nodeArr),
        ];
    }

    private static tagParagraph(page: Page): AstNode {
        const { note, formula } = page;
        const tagParagraphChildren = ArrayUtil.safeArray(note?.categories).concat(ArrayUtil.safeArray(note?.keywords)).concat(formula?.tags).map(k => {
            const wikilinkObj = Link.parseWikiLink(k);
            if (!wikilinkObj) {
                return AstNode.mdText({ data: `#${k}` });
            }
            const file = app.metadataCache.getFirstLinkpathDest(wikilinkObj.path, "");
            const path = file ? file.path : wikilinkObj.path;
            const display = wikilinkObj.display ? `#${wikilinkObj.display}` : null;
            return AstNode.textMarkBlockRef({ textMarkBlockRefId: path, textMarkTextContent: display });
        }).flatMap(item => [AstNode.text({ data: ", " }), item]).slice(1);

        const tagParagraph = tagParagraphChildren.length !== 0
            ? AstNode.p().setChildren(tagParagraphChildren)
            : AstNode.p().setChildren([AstNode.text({ data: "No tags" })]);

        return tagParagraph;
    }

    private static additionalInfo(page: Page): AstNode {
        const { formula } = page;
        if (!formula?.additionalInfo || formula?.additionalInfo.length === 0) {
            return AstNode.p().setChildren([AstNode.text({ data: "No additional note" })]);
        }

        const node = AstNode.table();

        const tableHeadRow = AstNode.tableRow().setChildren([AstNode.tableCell().setChildren([AstNode.text({ data: "" })]), AstNode.tableCell().setChildren([AstNode.text({ data: "" })])])

        const tableHeadNode = AstNode.tableHead().setChildren([tableHeadRow]);

        node.children.push(tableHeadNode);

        Object.entries(formula.additionalInfo).forEach(([key, value]) => {
            const keyCell = AstNode.tableCell().setChildren([AstNode.mdText({ data: key })]);
            const valueCell = AstNode.tableCell().setChildren(AstNodeTemplate.propValue(value));
            const rowNode = AstNode.tableRow().setChildren([keyCell, valueCell]);
            node.children.push(rowNode);
        })

        return node;
    }

    public static titleParagraph(page: Page): AstNode {
        const { file, note } = page;
        return AstNode.p().setChildren([
            AstNode.textMarkA({ textMarkAHref: `#${file.basename}`, textMarkTextContent: note?.title || file.basename }),
            AstNode.text({ data: ` | ` }),
            AstNode.textMarkBlockRef({ textMarkBlockRefId: file.path, textMarkTextContent: "📄" }),
            AstNode.text({ data: ` | ` }),
            AstNode.textMarkA({ textMarkAHref: note?.url, textMarkTextContent: "🔗" }),
        ])
    }

    private static itemSection(page: Page, headingLevel: number): AstNode[] {
        const { file, note, formula } = page;
        return [
            AstNode.h({ headingLevel }).setChildren([AstNode.mdText({ data: file.basename })]),
            AstNodeTemplate.titleParagraph(page),
            AstNode.p().setChildren([
                AstNode.mdText({ data: note?.description || "No description" })
            ]),
            AstNodeTemplate.tagParagraph(page),
            Link.parseWikiLink(formula?.image)?.toImageNode() ?? AstNode.p().setChildren([AstNode.text({ data: "No image" })]),
            AstNode.p().setChildren([
                AstNode.mdText({ data: `Created at: ${note?.ctime}` })
            ]),
            AstNode.blockquote().setChildren([
                AstNode.p().setChildren([
                    AstNode.mdText({ data: StringTemplate.replaceAllImageEmbed(note?.comment?.replace(/<br>/g, "\n") || "No comment") })
                ])
            ]),
            AstNodeTemplate.additionalInfo(page),
        ]
    }

    private static propValue(value: any, isEnableMDTextForCommonText: boolean = false): AstNode[] {
        if (value === null || value === undefined) {
            return [];
        }
        if (Array.isArray(value)) {
            return value.flatMap(v => [AstNode.br(), ...AstNodeTemplate.propValue(v, isEnableMDTextForCommonText)]).slice(1);
        }
        if (typeof value === "string") {
            const wikilinkObj = Link.parseWikiLink(value);
            const mdlinkObj = Link.parseMDLink(value);
            if (wikilinkObj) {
                const imageNode = wikilinkObj.toImageNode();
                return [wikilinkObj.toMDLink(), imageNode ? AstNode.br() : null, imageNode].filter(value => value !== null);
            } else if (mdlinkObj) {
                return [mdlinkObj.toMDLink()];
            } else if (/^http(s)?:\/\//.test(value)) {
                return [AstNode.textMarkA({ textMarkAHref: value, textMarkTextContent: value })];
            } else if (/^mailto:/.test(value)) {
                return [AstNode.textMarkA({ textMarkAHref: value, textMarkTextContent: value.replace(/^mailto:/, "") })];
            } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
                return [AstNode.mdText({ data: value })]
            } else {
                return [isEnableMDTextForCommonText ? AstNode.mdText({ data: value }) : AstNode.text({ data: value })];
            }
        }
        return [AstNode.text({ data: value + "" })];
    }
}

export default function getVideoMOC(FOLDER_ARRAY: string[]): string {
    return AstNodeTemplate.moc(FOLDER_ARRAY).toString();
}
