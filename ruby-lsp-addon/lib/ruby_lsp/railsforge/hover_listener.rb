# frozen_string_literal: true

module RubyLsp
  module RailsForge
    # Appends RailsForge schema context to ruby-lsp's own Hover response instead of
    # replacing it. ruby-lsp calls this for every node under the cursor; we only add
    # content when the node looks like an ActiveRecord attribute read/write
    # (`user.email`, `self.email =`, etc.) inside a model file.
    class HoverListener
      def initialize(response_builder, node_context, schema_index, dispatcher)
        @response_builder = response_builder
        @node_context = node_context
        @schema_index = schema_index

        dispatcher.register(self, :on_call_node_enter)
      end

      def on_call_node_enter(node)
        return unless node.respond_to?(:name)

        model_name = current_model_name
        return unless model_name

        column = @schema_index.columns_for_model(model_name).find { |c| c.name == node.name.to_s }
        return unless column

        @response_builder.push(
          "**RailsForge**: `#{column.name}` — `#{column.type}`" \
          "#{column.nullable ? '' : ' (NOT NULL)'} on `#{model_name}`",
          category: :documentation,
        )
      end

      private

      # Best-effort: the enclosing `class Foo < ApplicationRecord` name.
      def current_model_name
        @node_context.nesting.reverse.find { |n| n.is_a?(String) }
      end
    end
  end
end
