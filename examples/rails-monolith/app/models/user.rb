class User < ApplicationRecord
  has_many :articles, dependent: :destroy
  has_many :comments, dependent: :destroy

  validates :email, presence: true, uniqueness: true
  validates :name, presence: true

  enum role: { member: "member", author: "author", admin: "admin" }

  def admin?
    role == "admin"
  end
end
