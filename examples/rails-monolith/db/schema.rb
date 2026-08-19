ActiveRecord::Schema[7.1].define(version: 2026_08_19_000002) do
  create_table "users", force: :cascade do |t|
    t.string "email", null: false
    t.string "name"
    t.string "role", default: "member"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  create_table "articles", force: :cascade do |t|
    t.string "title", null: false
    t.text "body"
    t.string "status", default: "draft"
    t.integer "user_id", null: false
    t.integer "views_count", default: 0
    t.datetime "published_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_articles_on_user_id"
    t.index ["status"], name: "index_articles_on_status"
  end

  create_table "comments", force: :cascade do |t|
    t.text "content", null: false
    t.integer "article_id", null: false
    t.integer "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["article_id"], name: "index_comments_on_article_id"
    t.index ["user_id"], name: "index_comments_on_user_id"
  end

  add_foreign_key "articles", "users"
  add_foreign_key "comments", "articles"
  add_foreign_key "comments", "users"
end
