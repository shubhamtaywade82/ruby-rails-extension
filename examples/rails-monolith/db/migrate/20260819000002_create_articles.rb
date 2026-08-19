class CreateArticles < ActiveRecord::Migration[7.1]
  def change
    create_table :articles do |t|
      t.string :title, null: false
      t.text :body
      t.string :status, default: "draft"
      t.references :user, null: false, foreign_key: true
      t.integer :views_count, default: 0
      t.datetime :published_at
      t.timestamps
    end
    add_index :articles, :status
  end
end
