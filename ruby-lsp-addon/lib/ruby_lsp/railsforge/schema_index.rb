# frozen_string_literal: true

require 'pathname'

module RubyLsp
  module RailsForge
    # Minimal, dependency-free reader for db/schema.rb, mirroring the parsing
    # SchemaIndexer.ts does on the VS Code side. Kept intentionally simple (regex,
    # not a full Ruby parser) so it has no gem dependencies beyond ruby-lsp itself.
    class SchemaIndex
      Column = Struct.new(:name, :type, :nullable, keyword_init: true)

      def initialize(workspace_path)
        @workspace_path = Pathname.new(workspace_path)
        @tables = {}
        reload
      end

      def reload
        @tables = {}
        schema_file = @workspace_path.join('db', 'schema.rb')
        return unless schema_file.exist?

        current_table = nil
        schema_file.readlines.each do |line|
          stripped = line.strip

          if (match = stripped.match(/create_table\s+["']([^"']+)["']/))
            current_table = match[1]
            @tables[current_table] = []
          elsif current_table && (match = stripped.match(/t\.(\w+)\s+["']([^"']+)["'](?:,\s*(.*))?/))
            type, name, options = match.captures
            nullable = !(options && options.include?('null: false'))
            @tables[current_table] << Column.new(name: name, type: type, nullable: nullable)
          elsif stripped == 'end'
            current_table = nil
          end
        end
      end

      # e.g. columns_for_model("User") => columns of the "users" table
      def columns_for_model(model_name)
        table_name = pluralize(underscore(model_name))
        @tables[table_name] || []
      end

      private

      def underscore(str)
        str.gsub(/([A-Z])/) { "_#{Regexp.last_match(1)}" }.downcase.sub(/^_/, '')
      end

      def pluralize(str)
        return "#{str[0..-2]}ies" if str.end_with?('y') && !str.match?(/[aeiou]y$/)
        return str if str.end_with?('s')

        "#{str}s"
      end
    end
  end
end
