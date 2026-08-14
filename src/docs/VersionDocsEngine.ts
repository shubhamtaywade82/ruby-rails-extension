/**
 * VersionDocsEngine - Version-aware documentation and style guide hover provider
 */

import * as vscode from 'vscode'
import { ProjectEnvironment } from '../environment/EnvironmentDetector'

export interface DocEntry {
  keyword: string
  title: string
  railsVersionMin?: number
  summary: string
  guideUrl: string
  example?: string
}

export class VersionDocsEngine implements vscode.HoverProvider {
  private docs: Map<string, DocEntry> = new Map()

  constructor() {
    this.initDocs()
  }

  private initDocs(): void {
    const entries: DocEntry[] = [
      {
        keyword: 'has_many',
        title: 'ActiveRecord Association: has_many',
        summary: 'Specifies a one-to-many association. Supports `:through`, `:dependent`, and `:foreign_key`.',
        guideUrl: 'https://guides.rubyonrails.org/association_basics.html#the-has-many-association',
        example: 'has_many :comments, dependent: :destroy',
      },
      {
        keyword: 'belongs_to',
        title: 'ActiveRecord Association: belongs_to',
        summary: 'Specifies a one-to-one association to another class. In Rails 5+, `belongs_to` validates presence by default unless `optional: true`.',
        guideUrl: 'https://guides.rubyonrails.org/association_basics.html#the-belongs-to-association',
        example: 'belongs_to :user, optional: true',
      },
      {
        keyword: 'turbo_stream',
        title: 'Hotwire Turbo Stream Action',
        railsVersionMin: 7,
        summary: 'Delivers asynchronous DOM updates over WebSockets or HTTP responses (`append`, `prepend`, `replace`, `update`, `remove`).',
        guideUrl: 'https://turbo.hotwired.dev/handbook/streams',
        example: 'turbo_stream.replace "cart_summary", partial: "cart/summary"',
      },
      {
        keyword: 'before_action',
        title: 'ActionController Filter: before_action',
        summary: 'Appends a callback before every action execution. Replaced `before_filter` in Rails 5.0+.',
        guideUrl: 'https://guides.rubyonrails.org/action_controller_overview.html#filters',
        example: 'before_action :set_user, only: [:show, :edit, :update]',
      },
      {
        keyword: 'delegate',
        title: 'Module#delegate (Law of Demeter Helper)',
        summary: 'Provides `delegate` class method to easily expose contained methods without violating Law of Demeter.',
        guideUrl: 'https://api.rubyonrails.org/classes/Module.html#method-i-delegate',
        example: 'delegate :street, :city, to: :address, prefix: true',
      },
    ]

    for (const e of entries) {
      this.docs.set(e.keyword, e)
    }
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Hover> {
    const range = document.getWordRangeAtPosition(position)
    if (!range) {return null}

    const word = document.getText(range)
    const entry = this.docs.get(word)
    if (!entry) {return null}

    const md = new vscode.MarkdownString()
    md.isTrusted = true
    md.appendMarkdown(`### 📖 RailsForge Docs: \`${entry.title}\`\n\n`)
    md.appendMarkdown(`${entry.summary}\n\n`)
    if (entry.example) {
      md.appendMarkdown(`\`\`\`ruby\n${entry.example}\n\`\`\`\n\n`)
    }
    md.appendMarkdown(`[📚 Official Guide](${entry.guideUrl}) | [💎 Ruby Style Guide](https://rubystyle.guide/)`)

    return new vscode.Hover(md, range)
  }

  getDoc(topic: string, _env?: ProjectEnvironment): DocEntry | undefined {
    return this.docs.get(topic.trim().toLowerCase())
  }
}
